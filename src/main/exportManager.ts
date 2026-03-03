import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'
import archiver from 'archiver'
import { getFFmpegPath } from './ffmpegBridge'
import { EXPORT_CODECS } from '../shared/constants'
import type { ExportCodecKey } from '../shared/models'

// Video-Sequenz (Clip) exportieren
export function exportSequence(
  videoPath: string,
  startTime: number,
  endTime: number,
  outputPath: string,
  codec: ExportCodecKey | string,
  onProgress?: (progress: { progress: number; currentTime: number; duration: number }) => void,
): Promise<{ success: boolean; outputPath?: string; duration?: number; error?: string }> {
  return new Promise((resolve) => {
    try {
      // Path-Traversal-Schutz — Symlink-sicher (fix #88, #117)
      const homeDir = os.homedir()
      const tmpDir = os.tmpdir()
      let resolvedVideoPath: string
      try {
        resolvedVideoPath = fs.realpathSync(videoPath)
      } catch {
        resolve({ success: false, error: 'Access denied: video path not found' })
        return
      }
      if (
        !resolvedVideoPath.startsWith(homeDir + path.sep) &&
        !resolvedVideoPath.startsWith(tmpDir + path.sep)
      ) {
        resolve({ success: false, error: 'Access denied: video path outside allowed directories' })
        return
      }
      // Output-Pfad existiert noch nicht — Verzeichnis pruefen
      let resolvedOutputDir: string
      try {
        resolvedOutputDir = fs.realpathSync(path.dirname(outputPath))
      } catch {
        resolve({ success: false, error: 'Access denied: output directory not found' })
        return
      }
      if (!resolvedOutputDir.startsWith(homeDir + path.sep)) {
        resolve({
          success: false,
          error: 'Access denied: output path must be within home directory',
        })
        return
      }

      const outputDir = path.dirname(outputPath)
      if (!fs.existsSync(outputDir)) {
        resolve({ success: false, error: 'Output directory does not exist' })
        return
      }

      const ffmpegPath = getFFmpegPath()
      if (!ffmpegPath) {
        resolve({ success: false, error: 'ffmpeg not found' })
        return
      }

      const codecPreset = EXPORT_CODECS[codec as ExportCodecKey] || EXPORT_CODECS.H264

      // Ungueltige Zeitbereiche abfangen (fix #129)
      if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
        resolve({ success: false, error: 'Invalid time range: start must be before end' })
        return
      }
      const duration = endTime - startTime

      const args = [
        '-ss', String(startTime),
        '-i', videoPath,
        '-t', String(duration),
        ...codecPreset.args,
        outputPath,
      ]

      const ffmpeg = spawn(ffmpegPath, args)
      let lastReportedProgress = 0

      ffmpeg.stderr!.on('data', (data: Buffer) => {
        const output = data.toString()
        const timeMatch = output.match(/time=([\d:]+)/)
        if (timeMatch && onProgress) {
          const timeStr = timeMatch[1]
          const [hours, minutes, seconds] = timeStr.split(':').map(Number)
          const currentTime = hours * 3600 + minutes * 60 + seconds
          const progress = Math.min((currentTime / duration) * 100, 100)

          if (progress - lastReportedProgress > 1) {
            onProgress({ progress, currentTime, duration })
            lastReportedProgress = progress
          }
        }
      })

      ffmpeg.on('close', (code: number | null) => {
        if (code === 0) {
          resolve({ success: true, outputPath, duration })
        } else {
          resolve({ success: false, error: `ffmpeg failed with code ${code}` })
        }
      })

      ffmpeg.on('error', (error: Error) => {
        resolve({ success: false, error: error.message })
      })
    } catch (error) {
      resolve({ success: false, error: (error as Error).message })
    }
  })
}

// Thumbnails als ZIP-Archiv exportieren
export function exportZip(
  thumbnailPaths: string[],
  outputPath: string,
  onProgress?: (progress: {
    progress: number
    processedBytes: number
    totalBytes: number
  }) => void,
): Promise<{ success: boolean; outputPath?: string; fileSize?: number; error?: string }> {
  return new Promise((resolve) => {
    try {
      const outputDir = path.dirname(outputPath)
      if (!fs.existsSync(outputDir)) {
        resolve({ success: false, error: 'Output directory does not exist' })
        return
      }

      const output = fs.createWriteStream(outputPath)
      const archive = archiver('zip', { zlib: { level: 6 } })

      let resolvedFlag = false
      const safeResolve = (
        result: { success: boolean; outputPath?: string; fileSize?: number; error?: string },
      ) => {
        if (!resolvedFlag) {
          resolvedFlag = true
          resolve(result)
        }
      }

      output.on('close', () => {
        safeResolve({
          success: true,
          outputPath,
          fileSize: archive.pointer(),
        })
      })

      archive.on('error', (error: Error) => {
        safeResolve({ success: false, error: error.message })
      })

      // archive.on('entry') liefert kein sourcePath — 'progress' verwenden (fix #92)
      archive.on('progress', (progressData) => {
        if (onProgress && progressData.fs.totalBytes > 0) {
          onProgress({
            progress: (progressData.fs.processedBytes / progressData.fs.totalBytes) * 100,
            processedBytes: progressData.fs.processedBytes,
            totalBytes: progressData.fs.totalBytes,
          })
        }
      })

      archive.pipe(output)

      // Dateien zum Archiv hinzufuegen (Pfade gegen home/tmp validieren)
      const homeDir = os.homedir()
      const tmpDir = os.tmpdir()
      thumbnailPaths.forEach((thumbPath) => {
        if (typeof thumbPath !== 'string') return
        const resolved = path.resolve(thumbPath)
        const isAllowed =
          resolved.startsWith(homeDir + path.sep) || resolved.startsWith(tmpDir + path.sep)
        if (isAllowed && fs.existsSync(resolved)) {
          const filename = path.basename(resolved)
          archive.file(resolved, { name: filename })
        }
      })

      archive.finalize()
    } catch (error) {
      resolve({ success: false, error: (error as Error).message })
    }
  })
}

export default { exportSequence, exportZip }
