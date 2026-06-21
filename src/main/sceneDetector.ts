import { getFFmpegPath } from './ffmpegBridge'
import { secondsToTimecode } from '../shared/constants'
import { startJob, JobError } from './ffmpegJobManager'
import type { JobHandle } from './ffmpegJobManager'

interface DetectedScene {
  index: number
  startTime: number
  tc: string
}

interface DetectionProgressData {
  progress: number
  processedTime: number
  totalDuration: number
  scenesDetected: number
  newScenes: DetectedScene[]
}

interface DetectionResult {
  success: boolean
  scenes?: DetectedScene[]
  canceled?: boolean
  error?: string
}

// Aktiver Detection-Job — nun im ffmpegJobManager getrackt, killAll() erfasst ihn (fix Welle 2)
let _activeDetectJob: JobHandle | null = null

// Szenen im Video erkennen
export function detectScenes(
  videoPath: string,
  threshold: number,
  onProgress?: (progress: DetectionProgressData) => void,
): Promise<DetectionResult> {
  // Laufende Detection abbrechen bevor neue gestartet wird
  cancelDetection()

  return new Promise((resolve) => {
    const ffmpegPath = getFFmpegPath()
    if (!ffmpegPath) {
      resolve({ success: false, error: 'ffmpeg not found' })
      return
    }

    const safeThreshold = Math.max(0.01, Math.min(1.0, parseFloat(String(threshold)) || 0.3))

    const scenes: DetectedScene[] = []
    let totalDuration = 0
    let processedTime = 0
    // Zaehlt bereits gemeldete Szenen — sendet nur neu erkannte im Progress (rt-002)
    let lastReportedCount = 0
    const seenTimes = new Set<number>()

    const args = [
      '-i', videoPath,
      '-vf', `select='gt(scene,${safeThreshold})',showinfo`,
      '-vsync', 'vfr',
      '-f', 'null',
      '-',
    ]

    // pts_time-State-Machine als onStderrLine-Callback — bleibt domain-spezifisch hier.
    // Aktualisiert nur State (scenes, totalDuration, processedTime) — KEIN onProgress-Call.
    // Spawn/Tracking/Cancel liegt im ffmpegJobManager (Welle 2).
    const onStderrLine = (line: string): void => {
      // Duration extrahieren
      if (totalDuration === 0) {
        const durationMatch = line.match(/Duration: (\d+):(\d+):([\d.]+)/)
        if (durationMatch) {
          const hours = parseInt(durationMatch[1])
          const minutes = parseInt(durationMatch[2])
          const seconds = parseFloat(durationMatch[3])
          totalDuration = hours * 3600 + minutes * 60 + seconds
        }
      }

      // Scene-Timestamps aus showinfo extrahieren
      if (line.includes('pts_time:')) {
        const match = line.match(/pts_time:([\d.]+)/)
        if (match) {
          const time = parseFloat(match[1])
          if (!seenTimes.has(time)) {
            seenTimes.add(time)
            scenes.push({
              index: scenes.length,
              startTime: time,
              tc: secondsToTimecode(time),
            })
          }
          processedTime = Math.max(processedTime, time)
        }
      }

      // Progress aus Frame-Info-Zeilen
      if (line.includes('[Parsed_showinfo') && line.includes('pkt_pts_time=')) {
        const match = line.match(/pkt_pts_time=([\d.]+)/)
        if (match) {
          processedTime = Math.max(processedTime, parseFloat(match[1]))
        }
      }
    }

    // onStderrChunkDone: Pro stderr-Datenchunk einmal aufgerufen — NACH allen Zeilen des Chunks.
    // Batched Progress-Reporting: Ein onProgress-Call pro Chunk, nicht pro Zeile (rt-002).
    const onStderrChunkDone = (): void => {
      if (totalDuration > 0 && onProgress) {
        const progress = Math.min((processedTime / totalDuration) * 100, 100)
        const newScenes = scenes.slice(lastReportedCount)
        lastReportedCount = scenes.length
        onProgress({
          progress,
          processedTime,
          totalDuration,
          scenesDetected: scenes.length,
          newScenes,
        })
      }
    }

    const job = startJob({ type: 'detect', args, onStderrLine, onStderrChunkDone })
    _activeDetectJob = job

    job.done
      .then(() => {
        // Job-Referenz bereinigen wenn dies noch der aktive Job ist
        if (_activeDetectJob === job) {
          _activeDetectJob = null
        }
        resolve({ success: true, scenes })
      })
      .catch((err: unknown) => {
        if (_activeDetectJob === job) {
          _activeDetectJob = null
        }

        if (err instanceof JobError) {
          if (err.kind === 'cancelled') {
            resolve({ success: false, canceled: true, error: 'Detection canceled' })
          } else if (err.kind === 'ffmpeg-not-found') {
            resolve({ success: false, error: 'ffmpeg not found' })
          } else {
            // kind='failed': Exit-Code-Fehler
            resolve({
              success: false,
              error: err.code !== undefined
                ? `ffmpeg failed with code ${err.code}`
                : err.message,
            })
          }
        } else {
          // Unbekannter Fehler (z.B. synchroner Wurf)
          resolve({
            success: false,
            error: (err as Error).message,
          })
        }
      })
  })
}

// Laufende Detection abbrechen — ruft job.kill() auf dem aktuellen detect-Job auf
export function cancelDetection(): void {
  const job = _activeDetectJob
  _activeDetectJob = null
  if (job) {
    job.kill()
  }
}

// Hinweis: Detection laeuft seit Welle 2 ueber den ffmpegJobManager.
// killAll() erfasst detect-Jobs — cancelDetection() im before-quit/APP_CONFIRM_QUIT
// kann als explizite zusaetzliche Sicherheit bleiben (idempotent, schadet nicht).

export default { detectScenes, cancelDetection }
