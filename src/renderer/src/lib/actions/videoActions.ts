// videoActions.ts — Video-bezogene Aktionen
// Ersetzt Business-Logik aus V1 toolbar.js (openVideo, openVideoFromPath, loadVideo)

import * as ipc from '../ipc/bridge'
import {
  getVideoPath,
  setVideoPath,
  setVideoMeta,
  setScenes,
  setIsTranscoding,
  setTranscodeProgress,
  setIsDirty,
  setProjectPath,
  setCurrentShotIdx,
  getIsTranscoding,
} from '../stores'
import { resetSelectionState } from '../stores'
import * as undoRedo from './undoRedo'
import { showToast } from './toastManager'
import { SUPPORTED_FORMATS } from '../../../../shared/constants'

// --- Video-Load-Callback ---
// VideoPlayer.svelte registriert sich hier, um Videos zu laden

type LoadVideoFn = (filePath: string) => Promise<void>
type PauseAndResetFn = () => void

let _loadVideoFn: LoadVideoFn | null = null
let _pauseAndResetFn: PauseAndResetFn | null = null

/** VideoPlayer registriert seine loadVideo-Funktion (null = deregistrieren) */
export function registerLoadVideo(fn: LoadVideoFn | null): void {
  _loadVideoFn = fn
}

/** VideoPlayer registriert seine pauseAndReset-Funktion (null = deregistrieren) */
export function registerPauseAndReset(fn: PauseAndResetFn | null): void {
  _pauseAndResetFn = fn
}

/**
 * Video öffnen: Dialog → Pfad → openVideoFromPath
 */
export async function openVideo(): Promise<void> {
  try {
    const result = await ipc.openVideoDialog()
    if (!result?.success || !result.path) return
    await openVideoFromPath(result.path)
  } catch (err) {
    console.error('videoActions: openVideoDialog failed', err)
  }
}

/** Optionen fuer openVideoFromPath */
interface OpenVideoOptions {
  /** Wenn true: State-Reset ueberspringen (fuer openProject) */
  skipStateReset?: boolean
}

/**
 * Video per Pfad laden — Metadaten holen, Codec prüfen, ggf. Proxy generieren.
 * Wird von openVideo(), Drag&Drop und openProject aufgerufen.
 * Race-Condition-Guards nach jedem await (Fix #125).
 */
export async function openVideoFromPath(
  filePath: string,
  options?: OpenVideoOptions,
): Promise<void> {
  try {
    // Laufendes Transcoding abbrechen
    if (getIsTranscoding()) {
      await ipc.cancelProxy()
      setIsTranscoding(false)
      setTranscodeProgress(0)
    }

    // Metadaten abrufen
    const meta = await ipc.getVideoMeta(filePath)
    if (!meta?.success) {
      showToast('Failed to read video metadata', 'error')
      return
    }

    if (options?.skipStateReset) {
      // Nur Video-Pfad und Meta setzen (openProject hat State schon befuellt)
      setVideoPath(filePath)
      setVideoMeta(meta)
    } else {
      // Fallback-Projektverzeichnis
      const videoDir =
        filePath.substring(0, filePath.lastIndexOf('/')) ||
        filePath.substring(0, filePath.lastIndexOf('\\'))

      // State zurücksetzen für neues Video
      setVideoPath(filePath)
      setVideoMeta(meta)
      setScenes([])
      resetSelectionState()
      setCurrentShotIdx(-1)
      setProjectPath(videoDir)
      setIsDirty(true)
      undoRedo.clear()
    }

    const duration = meta.data?.duration ?? 0

    // Guard: zwischenzeitlich anderes Video? (Fix #125)
    if (getVideoPath() !== filePath) return

    if (!meta.data?.needsProxy) {
      try {
        if (_loadVideoFn) {
          await _loadVideoFn(filePath)
        }
        if (getVideoPath() !== filePath) return
        showToast('Video loaded successfully', 'success')
        return
      } catch (loadErr) {
        // Fallback auf Proxy bei Chromium-Inkompatibilität
        console.warn('videoActions: Direct load failed, falling back to proxy:', loadErr)
      }
    }

    // Guard vor Proxy-Start (Fix #125)
    if (getVideoPath() !== filePath) return

    // Proxy nötig → Transcoding starten
    await generateAndLoadProxy(filePath, duration)
  } catch (err) {
    console.error('videoActions: Failed to load video', err)
    setIsTranscoding(false)
    setTranscodeProgress(0)
    showToast('Failed to load video', 'error')
  }
}

/**
 * Proxy generieren und im Player laden
 */
async function generateAndLoadProxy(filePath: string, duration: number): Promise<void> {
  // Vorheriges Video stoppen (Fix #147)
  _pauseAndResetFn?.()
  setIsTranscoding(true)
  setTranscodeProgress(0)

  const result = await ipc.generateProxy(filePath, duration)

  // Race-Condition-Guard
  if (getVideoPath() !== filePath) {
    setIsTranscoding(false)
    setTranscodeProgress(0)
    return
  }

  setIsTranscoding(false)
  setTranscodeProgress(0)

  if (result?.success && result.proxyPath) {
    if (_loadVideoFn) {
      await _loadVideoFn(result.proxyPath)
    }
    const cached = (result as { cached?: boolean }).cached ? ' (cached)' : ''
    showToast(`Proxy loaded${cached}`, 'success')
  } else {
    showToast(result?.error ?? 'Transcoding failed', 'error')
  }
}

/** pauseAndReset aufrufen — für file:new etc. */
export function callPauseAndReset(): void {
  _pauseAndResetFn?.()
}

/**
 * Prüft ob eine Dateiendung unterstützt wird
 */
export function isSupportedFormat(filePath: string): boolean {
  const ext = ('.' + filePath.split('.').pop()?.toLowerCase()) as string
  return (SUPPORTED_FORMATS as readonly string[]).includes(ext)
}
