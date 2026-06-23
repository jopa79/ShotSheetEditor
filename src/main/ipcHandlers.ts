import { app, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import path from 'path'
import fs from 'fs'
import { IPC_CHANNELS } from '../shared/constants'
import { validateForRead, validateForWrite } from './pathSecurity'
import { getVideoMeta } from './videoManager'
import { detectScenes, cancelDetection } from './sceneDetector'
import { extractFrames } from './frameExtractor'
import { exportSequence, exportZip } from './exportManager'
import { exportClips, cancelClipExport } from './clipExporter'
import type { ClipExportRequest } from '../shared/models'
import { extractAudio } from './audioExtractor'
import { generateWaveform } from './waveformGenerator'
import type { AudioExtractRequest, WaveformGenerateRequest } from '../shared/ipcPayloads'
import { newProject, openProject, saveProject } from './projectManager'
import { showExportDirDialog, showOpenVideoDialog, showOpenProjectDialog, showSaveProjectDialog, showUnsavedChangesDialog } from './dialogManager'
import { toggleTheme, getThemeSource } from './windowManager'
import { getFFmpegPath, validateFFmpeg } from './ffmpegBridge'
import { needsTranscoding, generateProxy, cancelTranscoding } from './proxyGenerator'

// Handler mit try/catch wrappen
function wrapHandler<T>(
  handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<T>,
): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<T | { success: false; error: string }> {
  return async (event, ...args) => {
    try {
      return await handler(event, ...args)
    } catch (error) {
      console.error('IPC handler error:', error)
      return {
        success: false,
        error: (error as Error).message,
      }
    }
  }
}

// String-Input validieren
function validateString(value: unknown, name: string): string {
  if (!value || typeof value !== 'string') {
    throw new Error(`Invalid ${name}: expected a non-empty string`)
  }
  return value
}

// Numerischen Input innerhalb Grenzen validieren
function validateNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number | undefined,
  name: string,
): number {
  const num = parseFloat(String(value))
  if (!Number.isFinite(num)) {
    if (fallback !== undefined) return fallback
    throw new Error(`Invalid ${name}: expected a number`)
  }
  return Math.max(min, Math.min(max, num))
}

// ThumbSize-Dimensionen validieren
function validateThumbSize(
  thumbSize: unknown,
): { width: number; height: number } | undefined {
  if (!thumbSize || typeof thumbSize !== 'object') return undefined
  const ts = thumbSize as Record<string, unknown>
  return {
    width: validateNumber(ts.width, 32, 3840, 320, 'thumbSize.width'),
    height: validateNumber(ts.height, 32, 2160, 180, 'thumbSize.height'),
  }
}

// mainWindow-Getter — wird lazy aufgelöst, damit Handler vor Fenster-Erstellung registriert werden können
type WindowGetter = () => BrowserWindow | undefined

// Progress-Updates an Renderer senden
function sendProgress(getWindow: WindowGetter, channel: string, data: unknown): void {
  const win = getWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data)
  }
}

export function registerIpcHandlers(getMainWindow: WindowGetter): void {
  // Video-Operationen
  ipcMain.handle(
    IPC_CHANNELS.VIDEO_OPEN,
    wrapHandler(async (_event, filePath) => {
      validateString(filePath, 'filePath')
      const meta = await getVideoMeta(filePath as string)
      if (!meta || !meta.success) {
        return { success: false, error: meta?.error || 'Failed to open video' }
      }
      if (meta?.success && meta?.data) {
        ;(meta.data as Record<string, unknown>).needsProxy = needsTranscoding(
          meta.data.codec,
          filePath as string,
        )
      }
      return { success: true, path: filePath, meta }
    }),
  )

  ipcMain.handle(
    IPC_CHANNELS.VIDEO_GET_META,
    wrapHandler(async (_event, videoPath) => {
      validateString(videoPath, 'videoPath')
      const result = await getVideoMeta(videoPath as string)
      if (result?.success && result?.data) {
        ;(result.data as Record<string, unknown>).needsProxy = needsTranscoding(
          result.data.codec,
          videoPath as string,
        )
      }
      return result
    }),
  )

  // Scene Detection
  ipcMain.handle(
    IPC_CHANNELS.SCENE_DETECT,
    wrapHandler(async (_event, params) => {
      const { videoPath, threshold } = params as { videoPath: string; threshold: number }
      validateString(videoPath, 'videoPath')
      const safeThreshold = validateNumber(threshold, 0.01, 1.0, 0.3, 'threshold')
      return detectScenes(videoPath, safeThreshold, (progress) => {
        sendProgress(getMainWindow,IPC_CHANNELS.SCENE_DETECT_PROGRESS, progress)
      })
    }),
  )

  ipcMain.handle(IPC_CHANNELS.SCENE_DETECT_CANCEL, () => {
    cancelDetection()
    return { success: true }
  })

  // Frame-Extraktion
  ipcMain.handle(
    IPC_CHANNELS.FRAME_EXTRACT_BATCH,
    wrapHandler(async (_event, params) => {
      const { videoPath, scenes, outputDir, thumbSize } = params as {
        videoPath: string
        scenes: unknown[]
        outputDir: string
        thumbSize?: unknown
      }
      validateString(videoPath, 'videoPath')
      validateString(outputDir, 'outputDir')
      if (!Array.isArray(scenes)) {
        throw new Error('Invalid scenes: expected an array')
      }
      const safeThumbSize = validateThumbSize(thumbSize)
      return extractFrames(
        videoPath,
        scenes as { index: number; startTime: number; tc?: string }[],
        outputDir,
        safeThumbSize,
        (progress) => {
          sendProgress(getMainWindow,IPC_CHANNELS.FRAME_EXTRACT_PROGRESS, progress)
        },
      )
    }),
  )

  // Thumbnail-Abruf — base64-Daten fuer einzelne Datei
  ipcMain.handle(
    IPC_CHANNELS.FRAME_GET_THUMB,
    wrapHandler(async (_event, thumbPath) => {
      if (!thumbPath || typeof thumbPath !== 'string') {
        return { success: false, error: 'Invalid thumbnail path' }
      }

      const ext = path.extname(thumbPath as string).toLowerCase()
      if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
        return { success: false, error: 'Invalid file type' }
      }

      // Symlink-sichere Validierung via pathSecurity-Modul (fix #88)
      let resolved: string
      try {
        resolved = validateForRead(thumbPath as string, { allowTmp: true })
      } catch {
        return { success: false, error: 'Thumbnail not found or access denied' }
      }

      const data = await fs.promises.readFile(resolved)
      const base64 = data.toString('base64')
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'
      return { success: true, data: `data:${mimeType};base64,${base64}` }
    }),
  )

  // Projekt-Verwaltung
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_NEW,
    wrapHandler(async (_event, params) => {
      const { name, videoPath } = params as { name: string; videoPath: string }
      return newProject(name, videoPath)
    }),
  )

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_OPEN,
    wrapHandler(async (_event, projectPath) => {
      // Path-Traversal-Schutz — Symlink-sicher via pathSecurity-Modul (fix #88, #118)
      let resolved: string
      try {
        resolved = validateForRead(projectPath as string)
      } catch {
        return { success: false, error: 'Access denied: project path not found' }
      }
      return openProject(resolved)
    }),
  )

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_SAVE,
    wrapHandler(async (_event, params) => {
      const { projectPath, data } = params as { projectPath: string; data: Record<string, unknown> }
      validateString(projectPath, 'projectPath')
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid project data')
      }
      return saveProject(projectPath, data)
    }),
  )

  // Export-Operationen
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_SEQUENCE,
    wrapHandler(async (_event, data) => {
      const { videoPath, startTime, endTime, outputPath, codec } = data as {
        videoPath: string
        startTime: number
        endTime: number
        outputPath: string
        codec: string
      }

      // Path-Traversal-Schutz — Symlink-sicher via pathSecurity-Modul (fix #88, #117)
      let safeVideoPath: string
      try {
        safeVideoPath = validateForRead(videoPath, { allowTmp: true })
      } catch {
        return { success: false, error: 'Access denied: video path not found or outside allowed directories' }
      }
      // Output-Pfad: Parent-Verzeichnis validieren, nur homeDir erlaubt (kein tmp fuer User-Exports)
      let safeOutputPath: string
      try {
        safeOutputPath = validateForWrite(outputPath)
      } catch {
        return { success: false, error: 'Access denied: output path not found or outside allowed directories' }
      }

      return exportSequence(safeVideoPath, startTime, endTime, safeOutputPath, codec, (progress) => {
        sendProgress(getMainWindow,IPC_CHANNELS.EXPORT_SEQUENCE_PROGRESS, progress)
      })
    }),
  )

  ipcMain.handle(
    IPC_CHANNELS.EXPORT_ZIP,
    wrapHandler(async (_event, data) => {
      const { thumbnailPaths, outputPath } = data as {
        thumbnailPaths: string[]
        outputPath: string
      }
      // Output-Pfad: Parent-Verzeichnis validieren, nur homeDir erlaubt (analog EXPORT_SEQUENCE)
      let safeOutputPath: string
      try {
        safeOutputPath = validateForWrite(outputPath)
      } catch {
        return { success: false, error: 'Access denied: output path not found or outside allowed directories' }
      }
      return exportZip(thumbnailPaths, safeOutputPath, (progress) => {
        sendProgress(getMainWindow,IPC_CHANNELS.EXPORT_ZIP_PROGRESS, progress)
      })
    }),
  )

  // Clip-Export (Subclips): Pfad-/Codec-Validierung passiert in clipExporter
  ipcMain.handle(
    IPC_CHANNELS.CLIP_EXPORT,
    wrapHandler(async (_event, data) => {
      const request = data as ClipExportRequest
      return exportClips(request, (progress) => {
        sendProgress(getMainWindow, IPC_CHANNELS.CLIP_EXPORT_PROGRESS, progress)
      })
    }),
  )

  ipcMain.handle(IPC_CHANNELS.CLIP_EXPORT_CANCEL, () => {
    cancelClipExport()
    return { success: true }
  })

  // Audio-Extraktion (WAV) — Pfad-Validierung passiert in audioExtractor
  ipcMain.handle(
    IPC_CHANNELS.AUDIO_EXTRACT,
    wrapHandler(async (_event, data) => {
      return extractAudio(data as AudioExtractRequest)
    }),
  )

  // Waveform-Peaks aus WAV berechnen
  ipcMain.handle(
    IPC_CHANNELS.WAVEFORM_GENERATE,
    wrapHandler(async (_event, data) => {
      return generateWaveform(data as WaveformGenerateRequest)
    }),
  )

  ipcMain.handle(IPC_CHANNELS.EXPORT_SELECT_DIR, async () => {
    try {
      const win = getMainWindow()
      const result = await showExportDirDialog(win || undefined)
      if (result.canceled) {
        return { success: false, error: 'Canceled' }
      }
      return { success: true, path: result.filePaths[0] }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Theme-Verwaltung
  ipcMain.handle(IPC_CHANNELS.THEME_TOGGLE, () => {
    try {
      const theme = toggleTheme()
      const win = getMainWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.THEME_CHANGED, theme)
      }
      return { success: true, theme }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.THEME_GET, () => {
    try {
      const theme = getThemeSource()
      return { success: true, theme }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // App-Informationen
  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    try {
      const ffmpegInfo = validateFFmpeg()
      return {
        success: true,
        version: app.getVersion(),
        ffmpeg: ffmpegInfo,
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Dialoge — parentWindow fuer macOS Sheet-Modal (fix #164)
  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_VIDEO, async () => {
    try {
      const win = getMainWindow()
      const result = await showOpenVideoDialog(win || undefined)
      if (result.canceled) {
        return { success: false, error: 'Canceled' }
      }
      return { success: true, path: result.filePaths[0] }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_PROJECT, async () => {
    try {
      const win = getMainWindow()
      const result = await showOpenProjectDialog(win || undefined)
      if (result.canceled) {
        return { success: false, error: 'Canceled' }
      }
      return { success: true, path: result.filePaths[0] }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.DIALOG_SAVE_PROJECT, async () => {
    try {
      const win = getMainWindow()
      const result = await showSaveProjectDialog(win || undefined)
      if (result.canceled) {
        return { success: false, error: 'Canceled' }
      }
      return { success: true, path: result.filePath }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Proxy-Transkodierung
  ipcMain.handle(
    IPC_CHANNELS.PROXY_GENERATE,
    wrapHandler(async (_event, params) => {
      const { videoPath, duration } = params as { videoPath: string; duration: number }

      // Path-Traversal-Schutz — Symlink-sicher via pathSecurity-Modul (fix #88, #120)
      let safeVideoPath: string
      try {
        safeVideoPath = validateForRead(videoPath, { allowTmp: true })
      } catch {
        return { success: false, error: 'Access denied: video path not found or outside allowed directories' }
      }

      return generateProxy(safeVideoPath, duration, (progress) => {
        sendProgress(getMainWindow,IPC_CHANNELS.PROXY_GENERATE_PROGRESS, progress)
      })
    }),
  )

  ipcMain.handle(IPC_CHANNELS.PROXY_CANCEL, () => {
    cancelTranscoding()
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.DIALOG_UNSAVED_CHANGES, async () => {
    try {
      const win = getMainWindow()
      const response = await showUnsavedChangesDialog(win || undefined)
      return { success: true, response }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}

export default { registerIpcHandlers }
