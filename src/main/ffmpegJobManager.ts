/**
 * FFmpegJobManager — zentrales Spawn/Tracking/Cancel-Modul fuer alle ffmpeg-Jobs.
 *
 * Behebt:
 * - Duplizierte spawn/stderr/cancel-Logik in proxyGenerator und frameExtractor
 * - Fehlende Process-Tracking in frameExtractor → orphaned Prozesse bei Crash/Quit
 * - Race-Condition durch globale `let`-Variablen → eindeutige Job-IDs in einer Map
 *
 * Hinweis: sceneDetector ist (noch) NICHT migriert — seine zeilenbasierte
 * pts_time-State-Machine ist zu domain-spezifisch fuer dieses generische Modul.
 * Volle detect-Migration ist als Welle-2-Kandidat vorgemerkt.
 *
 * Interface (small):
 *   startJob(opts) → JobHandle { kill(), done }
 *   killAll()      → alle laufenden Jobs beenden (App-Quit)
 */

import { spawn } from 'child_process'
import { getFFmpegPath } from './ffmpegBridge'

// --- Typen ---

/** Typ des Jobs bestimmt das stderr-Parsing-Verhalten */
export type JobType = 'transcode' | 'extract'

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
  /** Progress-Callback */
  onProgress?: OnProgressCallback
}

/** Handle auf einen laufenden Job */
export interface JobHandle {
  /** Job-ID (eindeutig) */
  id: string
  /** Promise das resolved wenn der Job fertig ist (Code 0) oder rejected bei Fehler/Cancel */
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

// --- Job starten ---

/**
 * Startet einen ffmpeg-Job und gibt einen JobHandle zurueck.
 *
 * Der Prozess wird in der _activeJobs-Map verfolgt.
 * Bei kill() wird SIGTERM gesendet und der Eintrag bereinigt.
 * Bei App-Quit kann killAll() alle offenen Jobs beenden.
 */
export function startJob(opts: JobOptions): JobHandle {
  const ffmpegPath = getFFmpegPath()
  if (!ffmpegPath) {
    const id = _nextJobId()
    const done = Promise.reject(new Error('FFmpeg nicht gefunden'))
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

  // Chunk-Puffer fuer stderr-Parsing (Grenzfaelle)
  let chunkTail = ''

  // Done-Promise
  const done = new Promise<void>((resolve, reject) => {
    if (opts.onProgress) {
      const onProgress = opts.onProgress

      proc.stderr?.on('data', (data: Buffer) => {
        const chunk = chunkTail + data.toString()

        if (opts.type === 'transcode' && opts.duration && opts.duration > 0) {
          // Transcoding-Progress: time=HH:MM:SS.mmm aus stderr
          chunkTail = _parseTranscodeProgress(chunk, opts.duration, onProgress)
        } else {
          chunkTail = chunk.slice(-100)
        }
      })
    }
    // stdout und stderr werden von Node.js automatisch konsumiert (flowing mode)
    // wenn kein 'data'-Listener aktiv ist — kein resume() noetig

    proc.on('close', (code: number | null) => {
      _activeJobs.delete(id)
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(code === null ? 'Job abgebrochen' : `FFmpeg Fehler (Code ${code})`))
      }
    })

    proc.on('error', (err: Error) => {
      _activeJobs.delete(id)
      reject(err)
    })
  })

  return { id, done, kill: killFn }
}

/**
 * Beendet ALLE laufenden ffmpeg-Jobs.
 * Wird bei App-Quit aufgerufen um orphaned Prozesse zu vermeiden.
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
