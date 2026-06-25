// transcriber.ts — Lokale Transkription via whisper.cpp.
//
// Flow: Video → Audio extrahieren (16 kHz WAV) → whisper.cpp-Binary spawnen →
// Segment-Zeilen ([HH:MM:SS.mmm --> ...] text) aus stdout parsen → Segmente.
// Binary + Modell sind env-konfigurierbar (WHISPER_BIN / WHISPER_MODEL[_DIR]),
// da das Binary nicht gebundelt ist — fehlt es, gibt es einen klaren Fehler.

import { spawn, type ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import { extractAudio } from './audioExtractor'
import { WHISPER_DEFAULTS } from '../shared/constants'
import type {
  TranscriptionStartRequest,
  TranscriptionStartResponse,
  TranscriptionProgress,
} from '../shared/ipcPayloads'
import type { TranscriptionSegment, WhisperModel } from '../shared/models'

// Whitelist gegen Path-Traversal ueber den Modellnamen (`-m`-Argument)
const ALLOWED_MODELS: WhisperModel[] = ['tiny', 'base', 'small', 'medium']

let _activeProc: ChildProcess | null = null
let _cancelled = false
let _segCounter = 0
let _running = false // nur ein Lauf gleichzeitig (Modul-State)

// whisper.cpp Segment-Zeile: [HH:MM:SS.mmm --> HH:MM:SS.mmm]   Text
const SEGMENT_RE =
  /^\s*\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]\s*(.*)$/

function _toSeconds(h: string, m: string, s: string, ms: string): number {
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000
}

/** Eine whisper.cpp-Ausgabezeile in ein Segment parsen (null wenn keine Segmentzeile). */
export function parseSegmentLine(line: string): TranscriptionSegment | null {
  const m = line.match(SEGMENT_RE)
  if (!m) return null
  const text = m[9].trim()
  if (!text) return null
  return {
    id: `seg_${++_segCounter}`,
    startTime: _toSeconds(m[1], m[2], m[3], m[4]),
    endTime: _toSeconds(m[5], m[6], m[7], m[8]),
    text,
  }
}

/** Binary + Modell aufloesen (env-konfigurierbar). Wirft mit klarer Meldung wenn fehlend. */
function _resolveWhisper(model: WhisperModel): { bin: string; modelPath: string } {
  const bin = process.env.WHISPER_BIN
  if (!bin || !fs.existsSync(bin)) {
    throw new Error('Whisper binary not found — set WHISPER_BIN to your whisper-cli path')
  }
  const explicitModel = process.env.WHISPER_MODEL
  const modelDir = process.env.WHISPER_MODEL_DIR
  const modelPath = explicitModel ?? (modelDir ? path.join(modelDir, `ggml-${model}.bin`) : '')
  if (!modelPath || !fs.existsSync(modelPath)) {
    throw new Error(
      `Whisper model not found — set WHISPER_MODEL_DIR (expected ggml-${model}.bin) or WHISPER_MODEL`,
    )
  }
  return { bin, modelPath }
}

/** Laufende Transkription abbrechen. */
export function cancelTranscription(): void {
  _cancelled = true
  if (_activeProc) {
    try {
      _activeProc.kill('SIGTERM')
    } catch (err) {
      console.error('transcriber: cancel failed', err)
    }
  }
}

/**
 * Transkribiert das Video lokal via whisper.cpp und gibt die Segmente zurueck.
 */
export async function startTranscription(
  request: TranscriptionStartRequest,
  onProgress?: (progress: TranscriptionProgress) => void,
): Promise<TranscriptionStartResponse> {
  // Nur ein Lauf gleichzeitig — sonst korrumpieren parallele Calls den Modul-State
  if (_running) {
    return { success: false, error: 'Transcription already running' }
  }
  // Modell gegen Whitelist (verhindert Path-Traversal ueber den Modellnamen)
  if (!ALLOWED_MODELS.includes(request.model)) {
    return { success: false, error: 'Unknown Whisper model' }
  }

  _running = true
  _cancelled = false
  _segCounter = 0
  try {
    // 1. Binary + Modell aufloesen
    let bin: string
    let modelPath: string
    try {
      ;({ bin, modelPath } = _resolveWhisper(request.model))
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }

    // 2. Audiospur als 16 kHz Mono WAV extrahieren
    const audioRes = await extractAudio({
      videoPath: request.videoPath,
      sampleRate: WHISPER_DEFAULTS.sampleRate,
    })
    if (!audioRes.success || !audioRes.audioPath) {
      return { success: false, error: audioRes.error ?? 'audio extraction failed' }
    }

    // 3. whisper.cpp spawnen und stdout-Segmente parsen
    const language = request.language ?? WHISPER_DEFAULTS.language
    const args = ['-m', modelPath, '-f', audioRes.audioPath, '-l', language]

    return await new Promise<TranscriptionStartResponse>((resolve) => {
      const segments: TranscriptionSegment[] = []
      let stdoutTail = ''

      const proc = spawn(bin, args)
      _activeProc = proc

      proc.stdout?.on('data', (data: Buffer) => {
        const combined = stdoutTail + data.toString()
        const lines = combined.split('\n')
        stdoutTail = lines.pop() ?? '' // unvollstaendige Zeile aufbewahren
        for (const line of lines) {
          const seg = parseSegmentLine(line)
          if (seg) {
            segments.push(seg)
            onProgress?.({ percent: 0, currentSegment: segments.length, segments: [...segments] })
          }
        }
      })

      proc.on('close', (code: number | null) => {
        _activeProc = null
        const seg = parseSegmentLine(stdoutTail)
        if (seg) segments.push(seg)

        if (_cancelled) {
          resolve({ success: false, error: 'Transcription cancelled' })
        } else if (code === 0) {
          onProgress?.({ percent: 100, totalSegments: segments.length, segments })
          resolve({ success: true, segments })
        } else {
          resolve({ success: false, error: `Whisper failed with code ${code}` })
        }
      })

      proc.on('error', (err: Error) => {
        _activeProc = null
        resolve({ success: false, error: err.message })
      })
    })
  } finally {
    _running = false
  }
}

export default { startTranscription, cancelTranscription, parseSegmentLine }
