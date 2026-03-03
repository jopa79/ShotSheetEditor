import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { getFFprobePath } from './ffmpegBridge'
import { SUPPORTED_FORMATS } from '../shared/constants'

const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024 * 1024 // 50 GB

interface ValidationResult {
  valid: boolean
  error?: string
}

interface VideoMetaResult {
  success: boolean
  data?: {
    duration: number
    fps: number
    width: number
    height: number
    codec: string
    audioCodec: string | null
    fileSize: number
  }
  error?: string
}

// ffprobe Bruch-Strings sicher parsen ("30000/1001" oder "30")
function parseFraction(str: string | undefined): number {
  if (!str || typeof str !== 'string') return 0
  const parts = str.split('/')
  const numerator = parseFloat(parts[0])
  if (parts.length === 2) {
    const denominator = parseFloat(parts[1])
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0
    return numerator / denominator
  }
  return Number.isFinite(numerator) ? numerator : 0
}

// Video-Datei validieren
export function validateVideo(videoPath: string): ValidationResult {
  try {
    if (!fs.existsSync(videoPath)) {
      return { valid: false, error: 'File does not exist' }
    }

    const ext = path.extname(videoPath).toLowerCase()
    if (!SUPPORTED_FORMATS.includes(ext as typeof SUPPORTED_FORMATS[number])) {
      return {
        valid: false,
        error: `Unsupported format. Supported: ${SUPPORTED_FORMATS.join(', ')}`,
      }
    }

    const stats = fs.statSync(videoPath)
    if (stats.size > MAX_VIDEO_SIZE_BYTES) {
      return { valid: false, error: 'File too large (max 50 GB)' }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: (error as Error).message }
  }
}

// Video-Metadaten via ffprobe ermitteln
export function getVideoMeta(videoPath: string): Promise<VideoMetaResult> {
  return new Promise((resolve) => {
    try {
      const validation = validateVideo(videoPath)
      if (!validation.valid) {
        resolve({ success: false, error: validation.error })
        return
      }

      const ffprobePath = getFFprobePath()
      if (!ffprobePath) {
        resolve({ success: false, error: 'ffprobe not found' })
        return
      }

      const ffprobe = spawn(ffprobePath, [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath,
      ])

      let stdout = ''
      let stderr = ''

      ffprobe.stdout.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      ffprobe.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      ffprobe.on('close', (code: number | null) => {
        try {
          if (code !== 0) {
            resolve({
              success: false,
              error: `ffprobe failed: ${stderr || 'unknown error'}`,
            })
            return
          }

          const data = JSON.parse(stdout)
          const format = data.format || {}
          const videoStream = (data.streams || []).find(
            (s: { codec_type: string }) => s.codec_type === 'video',
          )
          const audioStream = (data.streams || []).find(
            (s: { codec_type: string }) => s.codec_type === 'audio',
          )

          resolve({
            success: true,
            data: {
              duration: parseFloat(format.duration) || 0,
              fps: videoStream?.r_frame_rate
                ? parseFraction(videoStream.r_frame_rate)
                : 0,
              width: videoStream?.width || 0,
              height: videoStream?.height || 0,
              codec: videoStream?.codec_name || 'unknown',
              audioCodec: audioStream?.codec_name || null,
              fileSize: parseInt(format.size) || 0,
            },
          })
        } catch (error) {
          resolve({
            success: false,
            error: `Failed to parse metadata: ${(error as Error).message}`,
          })
        }
      })

      ffprobe.on('error', (error: Error) => {
        resolve({
          success: false,
          error: `ffprobe error: ${error.message}`,
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

export default { getVideoMeta, validateVideo }
