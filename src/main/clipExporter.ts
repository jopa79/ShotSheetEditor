// clipExporter.ts — Exportiert einzelne Clips (Subclips) per ffmpeg.
//
// Schneidet pro ClipDefinition einen Clip aus dem Video (IN/OUT-Points) im
// gewaehlten Codec (ProRes/H.264). Batch sequentiell mit Gesamt-Fortschritt
// und Cancel-Unterstuetzung — der eigentliche ffmpeg-Lauf liegt im
// zentralen FFmpegJobManager (Tracking/Cancel inklusive).

import path from 'path'
import fs from 'fs'
import { startJob, JobError } from './ffmpegJobManager'
import type { JobHandle } from './ffmpegJobManager'
import { EXPORT_CODECS } from '../shared/constants'
import type { ClipExportRequest, ExportCodecKey } from '../shared/models'
import type { ClipExportProgress, ClipExportResponse } from '../shared/ipcPayloads'
import { validateForRead, validateForWrite } from './pathSecurity'

// Obergrenze gegen versehentliche/boesartige Riesen-Batches
const MAX_CLIPS = 500

// Aktueller Clip-Job + Cancel-Flag (nur ein Batch gleichzeitig)
let _activeJob: JobHandle | null = null
let _cancelled = false

/** Dateinamen-sicher machen (keine Pfad-Trenner / Sonderzeichen). */
function _sanitizeName(name: string, fallback: string): string {
  const cleaned = (name || '').trim().replace(/[^\w.-]+/g, '_').replace(/^[_.]+|_+$/g, '')
  return cleaned || fallback
}

/** Laufenden Clip-Export abbrechen. */
export function cancelClipExport(): void {
  _cancelled = true
  _activeJob?.kill()
}

/**
 * Exportiert alle Clips aus dem Request sequentiell.
 * Gibt die Liste der geschriebenen Dateipfade zurueck (auch bei Teil-Abbruch).
 */
export async function exportClips(
  request: ClipExportRequest,
  onProgress?: (progress: ClipExportProgress) => void,
): Promise<ClipExportResponse> {
  const { videoPath, clips, outputDir, codec } = request
  _cancelled = false

  if (!Array.isArray(clips) || clips.length === 0) {
    return { success: false, error: 'No clips to export' }
  }
  if (clips.length > MAX_CLIPS) {
    return { success: false, error: `Too many clips (max ${MAX_CLIPS})` }
  }

  // Video-Pfad: Symlink-sicher, home + tmp erlaubt (Originale/Proxies)
  let safeVideoPath: string
  try {
    safeVideoPath = validateForRead(videoPath, { allowTmp: true })
  } catch {
    return { success: false, error: 'Access denied: video path not found or outside allowed directories' }
  }

  const codecPreset = EXPORT_CODECS[codec as ExportCodecKey] || EXPORT_CODECS.H264
  const exportedClips: string[] = []

  for (let i = 0; i < clips.length; i++) {
    if (_cancelled) {
      return { success: false, error: 'Clip export cancelled', exportedClips }
    }

    const clip = clips[i]
    if (!Number.isFinite(clip.startTime) || !Number.isFinite(clip.endTime) || clip.endTime <= clip.startTime) {
      return { success: false, error: `Invalid time range for clip "${clip.name}"`, exportedClips }
    }
    const duration = clip.endTime - clip.startTime

    // codecPreset.extension enthaelt bereits den fuehrenden Punkt (".mov"/".mp4")
    const fileName = `${_sanitizeName(clip.name, `clip_${i + 1}`)}${codecPreset.extension}`
    // Output-Pfad: nur homeDir erlaubt (kein tmp fuer User-Exports)
    let safeOutputPath: string
    try {
      safeOutputPath = validateForWrite(path.join(outputDir, fileName))
    } catch {
      return { success: false, error: 'Access denied: output path outside home directory', exportedClips }
    }
    if (!fs.existsSync(path.dirname(safeOutputPath))) {
      return { success: false, error: 'Output directory does not exist', exportedClips }
    }

    const args = [
      '-ss', String(clip.startTime),
      '-i', safeVideoPath,
      '-t', String(duration),
      '-y',
      ...codecPreset.args,
      safeOutputPath,
    ]

    const job = startJob({
      type: 'transcode',
      args,
      duration,
      onProgress: (data) => {
        if (!data || !onProgress) return
        // Gesamt-Fortschritt: abgeschlossene Clips + Anteil des aktuellen Clips
        const clipFraction = Math.min(Math.max(data.progress, 0), 100) / 100
        const percent = Math.round(((i + clipFraction) / clips.length) * 100)
        onProgress({ percent, currentClip: i + 1, totalClips: clips.length, currentName: clip.name })
      },
    })
    _activeJob = job

    try {
      await job.done
      exportedClips.push(safeOutputPath)
    } catch (err) {
      _activeJob = null
      if (err instanceof JobError && err.kind === 'cancelled') {
        return { success: false, error: 'Clip export cancelled', exportedClips }
      }
      const msg = err instanceof Error ? err.message : 'ffmpeg failed'
      return { success: false, error: `Clip "${clip.name}" failed: ${msg}`, exportedClips }
    }
    _activeJob = null
  }

  onProgress?.({ percent: 100, currentClip: clips.length, totalClips: clips.length })
  return { success: true, exportedClips }
}

export default { exportClips, cancelClipExport }
