/**
 * FFmpegJobManager — zentrales Spawn/Tracking/Cancel-Modul fuer alle ffmpeg-Jobs.
 *
 * Behebt:
 * - Duplizierte spawn/stderr/cancel-Logik in proxyGenerator, frameExtractor und sceneDetector
 * - Fehlende Process-Tracking → orphaned Prozesse bei Crash/Quit
 * - Race-Condition durch globale `let`-Variablen → eindeutige Job-IDs in einer Map
 * - Fragilies String-Matching in catch-Bloecken → typisierte JobError-Kinds
 *
 * Interface (small):
 *   startJob(opts) → JobHandle { kill(), done }
 *   killAll()      → alle laufenden Jobs beenden (App-Quit)
 *   JobError       → typisierter Fehler mit kind: 'cancelled' | 'ffmpeg-not-found' | 'failed'
 */

import { spawn } from 'child_process'
import { getFFmpegPath } from './ffmpegBridge'

// --- Typen ---

/** Typ des Jobs bestimmt das stderr-Parsing-Verhalten */
export type JobType = 'transcode' | 'extract' | 'detect'

/** Typisierter Fehler — ersetzt fragilies String-Matching in catch-Bloecken */
export class JobError extends Error {
  /** Art des Fehlers:
   * - 'cancelled'       — Prozess wurde via SIGTERM beendet (close code null)
   * - 'ffmpeg-not-found' — ffmpeg-Binary nicht gefunden (getFFmpegPath() = null)
   * - 'failed'          — ffmpeg Exit-Code != 0 oder spawn-Error
   */
  kind: 'cancelled' | 'ffmpeg-not-found' | 'failed'
  /** Exit-Code von ffmpeg (nur bei kind='failed' mit Exit-Code) */
  code?: number

  constructor(kind: 'cancelled' | 'ffmpeg-not-found' | 'failed', message: string, code?: number) {
    super(message)
    this.name = 'JobError'
    this.kind = kind
    this.code = code
  }
}

/** Callback-Typen je nach Job-Typ */
export interface TranscodeProgressData {
  progress: number
}

export type ProgressData = TranscodeProgressData | undefined

export type OnProgressCallback = (data: ProgressData) => void

export interface JobOptions {
  /** Job-Typ — bestimmt stderr-Parsing */
  type: JobType
  /** FFmpeg-Argumente (ohne den ffmpeg-Pfad selbst) */
  args: string[]
  /** Dauer des Videos in Sekunden (fuer Transcoding-Progress) */
  duration?: number
  /** Progress-Callback (nur fuer type='transcode') */
  onProgress?: OnProgressCallback
  /**
   * Zeilenbasierter stderr-Callback (nur fuer type='detect').
   * Wird fuer jede vollstaendige Zeile (terminiert mit \n) aufgerufen.
   * Die domain-spezifische pts_time-State-Machine bleibt im Aufrufer,
   * Spawn/Tracking/Cancel liegen im JobManager.
   */
  onStderrLine?: (line: string) => void
  /**
   * Wird einmal pro stderr-Datenchunk aufgerufen — NACH allen onStderrLine-Calls des Chunks.
   * Erlaubt batched Progress-Reporting pro Chunk statt pro Zeile.
   * (nur relevant wenn onStderrLine gesetzt ist)
   */
  onStderrChunkDone?: () => void
}

/** Handle auf einen laufenden Job */
export interface JobHandle {
  /** Job-ID (eindeutig) */
  id: string
  /** Promise das resolved wenn der Job fertig ist (Code 0) oder rejected mit JobError */
  done: Promise<void>
  /** Job sanft beenden (SIGTERM) */
  kill(): void
}

// --- Interner State ---

let _jobCounter = 0
const _activeJobs = new Map<string, { kill: () => void }>()

// --- Hilfsfunktion: naechste Job-ID ---
function _nextJobId(): string {
  _jobCounter++
  return `ffmpeg-job-${_jobCounter}`
}

// --- Stderr-Parser fuer Transcoding-Progress ---
// Erkennt time=HH:MM:SS.mmm und berechnet Prozentwert (geklammert auf 99)
function _parseTranscodeProgress(
  chunk: string,
  duration: number,
  onProgress: OnProgressCallback,
): string {
  const timeMatches = chunk.match(/time=(\d+):(\d+):([\d.]+)/g)
  if (timeMatches && duration > 0) {
    const lastMatch = timeMatches[timeMatches.length - 1]
    const parts = lastMatch.match(/time=(\d+):(\d+):([\d.]+)/)
    if (parts) {
      const hours = parseInt(parts[1])
      const minutes = parseInt(parts[2])
      const seconds = parseFloat(parts[3])
      const currentTime = hours * 3600 + minutes * 60 + seconds
      const progress = Math.min((currentTime / duration) * 100, 99)
      onProgress({ progress: Math.round(progress) } as TranscodeProgressData)
    }
  }
  // Letzten Chunk-Rest behalten fuer Grenzfaelle
  return chunk.slice(-100)
}

// --- Stderr-Parser fuer detect-Jobs (zeilenbasiert) ---
// Teilt Rohdaten in vollstaendige Zeilen auf und ruft onStderrLine pro Zeile auf.
// Gibt den unvollstaendigen Zeilenrest zurueck (kein trailing \n).
function _parseDetectStderr(
  rawChunk: string,
  lineBuffer: string,
  onStderrLine: (line: string) => void,
): string {
  const combined = lineBuffer + rawChunk
  const lines = combined.split('\n')
  // Letztes Element ist unvollstaendige Zeile (oder leer nach trailing \n)
  const remainder = lines.pop()!

  for (const line of lines) {
    onStderrLine(line)
  }

  return remainder
}

// --- Job starten ---

/**
 * Startet einen ffmpeg-Job und gibt einen JobHandle zurueck.
 *
 * Der Prozess wird in der _activeJobs-Map verfolgt.
 * Bei kill() wird SIGTERM gesendet und der Eintrag bereinigt.
 * Bei App-Quit kann killAll() alle offenen Jobs beenden.
 *
 * Das done-Promise rejected bei Fehler immer mit JobError (typisiert):
 *   - kind='cancelled'        → close code = null (SIGTERM)
 *   - kind='ffmpeg-not-found' → kein ffmpeg-Binary gefunden
 *   - kind='failed'           → Exit-Code != 0 oder spawn-Fehler
 */
export function startJob(opts: JobOptions): JobHandle {
  const ffmpegPath = getFFmpegPath()
  if (!ffmpegPath) {
    const id = _nextJobId()
    const done = Promise.reject(
      new JobError('ffmpeg-not-found', 'FFmpeg nicht gefunden'),
    )
    done.catch(() => {}) // Unhandled rejection vermeiden
    return { id, done, kill: () => {} }
  }

  const id = _nextJobId()
  const proc = spawn(ffmpegPath, opts.args)

  // Prozess in Map registrieren
  const killFn = () => {
    _activeJobs.delete(id)
    try {
      proc.kill('SIGTERM')
    } catch (err) {
      console.error(`[FFmpegJobManager] Fehler beim Beenden von Job ${id}:`, err)
    }
  }
  _activeJobs.set(id, { kill: killFn })

  // Zeilenpuffer fuer detect-Jobs (verhindert Verarbeitung unvollstaendiger Zeilen)
  let _lineBuffer = ''
  // Chunk-Puffer fuer Transcoding-Grenzfaelle
  let _chunkTail = ''

  // Done-Promise
  const done = new Promise<void>((resolve, reject) => {
    proc.stderr?.on('data', (data: Buffer) => {
      const raw = data.toString()

      if (opts.type === 'transcode' && opts.duration && opts.duration > 0 && opts.onProgress) {
        // Transcoding-Progress: time=HH:MM:SS.mmm aus stderr
        _chunkTail = _parseTranscodeProgress(_chunkTail + raw, opts.duration, opts.onProgress)
      } else if (opts.type === 'detect' && opts.onStderrLine) {
        // detect-Jobs: zeilenbasierter Callback — State-Machine bleibt im Aufrufer
        _lineBuffer = _parseDetectStderr(raw, _lineBuffer, opts.onStderrLine)
        // Chunk-Done-Hook: einmalig nach allen Zeilen des Chunks (fuer batched Progress)
        if (opts.onStderrChunkDone) {
          opts.onStderrChunkDone()
        }
      }
      // extract-Jobs: stderr ignorieren (kein Progress noetig)
    })

    proc.on('close', (code: number | null) => {
      _activeJobs.delete(id)
      if (code === 0) {
        resolve()
      } else if (code === null) {
        // SIGTERM erhalten → Job wurde abgebrochen
        reject(new JobError('cancelled', 'Job abgebrochen'))
      } else {
        reject(new JobError('failed', `FFmpeg Fehler (Code ${code})`, code))
      }
    })

    proc.on('error', (err: Error) => {
      _activeJobs.delete(id)
      reject(new JobError('failed', err.message))
    })
  })

  return { id, done, kill: killFn }
}

/**
 * Beendet ALLE laufenden ffmpeg-Jobs.
 * Wird bei App-Quit aufgerufen um orphaned Prozesse zu vermeiden.
 * Erfasst seit Welle 2 auch detect-Jobs (sceneDetector migriert).
 */
export function killAll(): void {
  const jobIds = Array.from(_activeJobs.keys())
  for (const id of jobIds) {
    const job = _activeJobs.get(id)
    if (job) {
      job.kill()
    }
  }
}

/**
 * Anzahl der aktuell laufenden Jobs (fuer Tests und Monitoring).
 */
export function activeJobCount(): number {
  return _activeJobs.size
}

export default { startJob, killAll, activeJobCount }
