import { spawn } from 'child_process'
import { getFFmpegPath } from './ffmpegBridge'
import { secondsToTimecode } from '../shared/constants'

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

// Aktiver Detection-Prozess — als ChildProcess-Referenz (zeilenbasiertes stderr-Parsing
// ist zu domain-spezifisch fuer generischen JobManager-stderr-Handler)
import type { ChildProcess } from 'child_process'

let _detectionProcess: ChildProcess | null = null
// Flag ob Abbruch angefordert wurde — verhindert false-success bei cancel (fix #114)
let _cancelRequested = false

// Szenen im Video erkennen
export function detectScenes(
  videoPath: string,
  threshold: number,
  onProgress?: (progress: DetectionProgressData) => void,
): Promise<DetectionResult> {
  // Laufende Detection abbrechen bevor neue gestartet wird
  cancelDetection()
  _cancelRequested = false

  return new Promise((resolve) => {
    try {
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

      const args = [
        '-i', videoPath,
        '-vf', `select='gt(scene,${safeThreshold})',showinfo`,
        '-vsync', 'vfr',
        '-f', 'null',
        '-',
      ]

      // Lokale Referenz — verhindert Race Condition bei concurrent Calls (fix #121)
      const proc = spawn(ffmpegPath, args)
      _detectionProcess = proc

      let lineBuffer = ''
      const seenTimes = new Set<number>()

      // stderr parsen fuer Scene-Detection-Output (zeilenbasierte State-Machine)
      proc.stderr!.on('data', (data: Buffer) => {
        lineBuffer += data.toString()

        const lines = lineBuffer.split('\n')
        lineBuffer = lines.pop()! // Unvollstaendige Zeile behalten

        for (const line of lines) {
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

        // Progress melden — neu erkannte Szenen mitsenden (rt-002)
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
      })

      proc.stdout!.on('data', () => {
        // stdout ignorieren (null-Format)
      })

      proc.on('close', (code: number | null) => {
        // Nur nullen wenn dieser Prozess noch der aktuelle ist (fix #121)
        if (_detectionProcess === proc) {
          _detectionProcess = null
        }

        if (code === 0) {
          resolve({ success: true, scenes })
        } else if (_cancelRequested || code === null) {
          resolve({ success: false, canceled: true, error: 'Detection canceled' })
        } else {
          resolve({
            success: false,
            error: `ffmpeg failed with code ${code}`,
          })
        }
      })

      proc.on('error', (error: Error) => {
        if (_detectionProcess === proc) {
          _detectionProcess = null
        }
        resolve({
          success: false,
          error: error.message,
        })
      })
    } catch (error) {
      resolve({
        success: false,
        error: (error as Error).message,
      })
    }
  })
}

// Laufende Detection abbrechen
export function cancelDetection(): void {
  _cancelRequested = true
  if (_detectionProcess) {
    try {
      _detectionProcess.kill('SIGTERM')
      _detectionProcess = null
    } catch (error) {
      console.error('Error cancelling detection:', error)
    }
  }
}

// Hinweis: Detection laeuft mit eigenem spawn (NICHT im ffmpegJobManager).
// killAll() erfasst sie daher NICHT — fuer Quit/Abbruch muss cancelDetection()
// explizit aufgerufen werden (siehe index.ts before-quit + APP_CONFIRM_QUIT).
// Volle Migration in den JobManager ist als Welle-2-Kandidat vorgemerkt.

export default { detectScenes, cancelDetection }
