// audioExtractor.ts — Extrahiert die Tonspur eines Videos als WAV.
//
// Standard: 16 kHz, Mono, PCM s16le — das von Whisper erwartete Format.
// Dieselbe WAV dient auch als Quelle fuer die Waveform-Peak-Berechnung.
// Der ffmpeg-Lauf liegt im zentralen FFmpegJobManager (Tracking/Cancel bei Quit).

import path from 'path'
import fs from 'fs'
import os from 'os'
import crypto from 'crypto'
import { startJob, JobError } from './ffmpegJobManager'
import { WHISPER_DEFAULTS } from '../shared/constants'
import type { AudioExtractRequest, AudioExtractResponse } from '../shared/ipcPayloads'
import { validateForRead, validateForWrite } from './pathSecurity'

const AUDIO_TEMP_DIR_NAME = 'shotsheet-audio'

/** Temp-Verzeichnis fuer extrahierte Audiodateien (bei Bedarf erstellen). */
function _getAudioTempDir(): string {
  const dir = path.join(os.tmpdir(), AUDIO_TEMP_DIR_NAME)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** Stabiler Default-Output-Pfad (gleicher Input + Samplerate → gleiche Datei). */
function _defaultOutputPath(videoPath: string, sampleRate: number): string {
  const hash = crypto.createHash('md5').update(`${videoPath}:${sampleRate}`).digest('hex')
  return path.join(_getAudioTempDir(), `${hash}.wav`)
}

/**
 * Extrahiert die Audiospur als WAV. Gibt den Pfad der erzeugten Datei zurueck.
 * outputPath optional — sonst wird eine stabile Temp-Datei erzeugt.
 */
export async function extractAudio(request: AudioExtractRequest): Promise<AudioExtractResponse> {
  const { videoPath } = request
  const sampleRate = request.sampleRate ?? WHISPER_DEFAULTS.sampleRate

  // Video-Pfad: Symlink-sicher, home + tmp erlaubt (Originale/Proxies)
  let safeVideoPath: string
  try {
    safeVideoPath = validateForRead(videoPath, { allowTmp: true })
  } catch {
    return { success: false, error: 'Access denied: video path not found or outside allowed directories' }
  }

  // Output-Pfad: Default im Temp-Verzeichnis (tmp erlaubt — Zwischendatei)
  const targetPath = request.outputPath ?? _defaultOutputPath(safeVideoPath, sampleRate)
  let safeOutputPath: string
  try {
    safeOutputPath = validateForWrite(targetPath, { allowTmp: true })
  } catch {
    return { success: false, error: 'Access denied: output path outside allowed directories' }
  }
  // Greift nur beim User-uebergebenen outputPath — der Default-Pfad existiert
  // bereits (mkdirSync in _getAudioTempDir).
  if (!fs.existsSync(path.dirname(safeOutputPath))) {
    return { success: false, error: 'Output directory does not exist' }
  }

  // -vn: kein Video · pcm_s16le: 16-bit · -ar: Samplerate · -ac 1: Mono
  const args = [
    '-i', safeVideoPath,
    '-vn',
    '-acodec', 'pcm_s16le',
    '-ar', String(sampleRate),
    '-ac', '1',
    '-y',
    safeOutputPath,
  ]

  try {
    const job = startJob({ type: 'extract', args })
    await job.done
    return { success: true, audioPath: safeOutputPath }
  } catch (err) {
    if (err instanceof JobError && err.kind === 'cancelled') {
      return { success: false, error: 'Audio extraction cancelled' }
    }
    const msg = err instanceof Error ? err.message : 'ffmpeg failed'
    return { success: false, error: `Audio extraction failed: ${msg}` }
  }
}

export default { extractAudio }
