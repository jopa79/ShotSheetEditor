import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { getFFmpegPath } from './ffmpegBridge'
import { THUMB_SIZE } from '../shared/constants'
import type { ThumbSize } from '../shared/models'

const MAX_CONCURRENT_EXTRACTIONS = 5

interface ExtractResult {
  success: boolean
  path?: string
  error?: string
}

interface FrameResult {
  index: number
  path: string
  timestamp: number
  tc?: string
}

interface ExtractProgressData {
  progress: number
  completed: number
  total: number
  frameResult?: { index: number; path: string }
}

interface SceneInput {
  index: number
  startTime: number
  tc?: string
}

// Einzelnes Frame extrahieren
export function extractFrame(
  videoPath: string,
  timestamp: number,
  outputPath: string,
  thumbSize: ThumbSize,
): Promise<ExtractResult> {
  return new Promise((resolve) => {
    try {
      const ffmpegPath = getFFmpegPath()
      if (!ffmpegPath) {
        resolve({ success: false, error: 'ffmpeg not found' })
        return
      }

      const args = [
        '-y', // Existierende Dateien ueberschreiben
        '-ss', String(timestamp),
        '-i', videoPath,
        '-vframes', '1',
        '-vf', `scale=${thumbSize.width}:${thumbSize.height}:force_original_aspect_ratio=decrease,pad=${thumbSize.width}:${thumbSize.height}:(ow-iw)/2:(oh-ih)/2`,
        '-q:v', '4',
        outputPath,
      ]

      const ffmpeg = spawn(ffmpegPath, args)

      ffmpeg.on('close', (code: number | null) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve({ success: true, path: outputPath })
        } else {
          resolve({
            success: false,
            error: `ffmpeg failed with code ${code}`,
          })
        }
      })

      ffmpeg.on('error', (error: Error) => {
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

// Mehrere Frames mit Concurrency extrahieren
export async function extractFrames(
  videoPath: string,
  scenes: SceneInput[],
  outputDir: string,
  thumbSize: ThumbSize | undefined,
  onProgress?: (progress: ExtractProgressData) => void,
): Promise<{ success: boolean; frames?: FrameResult[]; error?: string }> {
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    if (scenes.length === 0) {
      return { success: true, frames: [] }
    }

    const frames: FrameResult[] = []
    const queue = scenes.map((scene, idx) => ({ index: idx, scene }))

    let processing = 0
    let completed = 0

    return new Promise((resolve) => {
      const processNext = async () => {
        if (queue.length === 0 && processing === 0) {
          if (onProgress) {
            onProgress({ progress: 100, completed: scenes.length, total: scenes.length })
          }
          resolve({ success: true, frames })
          return
        }

        if (processing >= MAX_CONCURRENT_EXTRACTIONS || queue.length === 0) {
          return
        }

        const task = queue.shift()!
        processing++

        try {
          const filename = `frame_${String(task.scene.index).padStart(4, '0')}.jpg`
          const outputPath = path.join(outputDir, filename)

          const result = await extractFrame(
            videoPath,
            task.scene.startTime,
            outputPath,
            thumbSize || THUMB_SIZE,
          )

          if (result.success) {
            frames[task.index] = {
              index: task.scene.index,
              path: outputPath,
              timestamp: task.scene.startTime,
              tc: task.scene.tc,
            }
          } else {
            console.error(`Failed to extract frame ${task.scene.index}:`, result.error)
          }

          completed++

          if (onProgress) {
            const progressData: ExtractProgressData = {
              progress: (completed / scenes.length) * 100,
              completed,
              total: scenes.length,
            }
            if (result.success) {
              progressData.frameResult = {
                index: task.scene.index,
                path: outputPath,
              }
            }
            onProgress(progressData)
          }
        } catch (error) {
          console.error('Error extracting frame:', error)
        } finally {
          processing--
          processNext()
        }
      }

      // Initiale Batch starten
      for (let i = 0; i < MAX_CONCURRENT_EXTRACTIONS; i++) {
        processNext()
      }
    })
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    }
  }
}

export default { extractFrames, extractFrame }
