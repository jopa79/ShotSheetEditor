import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { spawn, type ChildProcess } from 'child_process'
import { getFFmpegPath } from './ffmpegBridge'
import { PROXY_CONFIG } from '../shared/constants'

let transcodingProcess: ChildProcess | null = null

// Pruefen ob ein Video transkodiert werden muss
export function needsTranscoding(codec: string, filePath: string): boolean {
  const codecLower = (codec || '').toLowerCase()
  const ext = path.extname(filePath).toLowerCase()

  const codecOk = PROXY_CONFIG.BROWSER_COMPATIBLE_CODECS.includes(codecLower)
  const containerOk = PROXY_CONFIG.BROWSER_COMPATIBLE_CONTAINERS.includes(ext)

  return !codecOk || !containerOk
}

// Stabilen Dateinamen fuer Proxy erzeugen (MD5 vom Original-Pfad)
function _getProxyFileName(inputPath: string): string {
  const hash = crypto.createHash('md5').update(inputPath).digest('hex')
  return `${hash}.mp4`
}

// Proxy-Verzeichnis zurueckgeben, bei Bedarf erstellen
function _getProxyDir(): string {
  const proxyDir = path.join(os.tmpdir(), PROXY_CONFIG.TEMP_DIR_NAME)
  fs.mkdirSync(proxyDir, { recursive: true })
  return proxyDir
}

// Pruefen ob bereits ein Proxy existiert
export function getExistingProxy(inputPath: string): string | null {
  const proxyDir = path.join(os.tmpdir(), PROXY_CONFIG.TEMP_DIR_NAME)
  const proxyPath = path.join(proxyDir, _getProxyFileName(inputPath))

  try {
    const stats = fs.statSync(proxyPath)
    if (stats.size > 0) {
      return proxyPath
    }
    // Leere Datei aufraeumen (abgebrochenes Transcoding)
    fs.unlinkSync(proxyPath)
  } catch {
    // Datei existiert nicht
  }

  return null
}

// Video zu Browser-kompatiblem H.264 Proxy transkodieren
export function generateProxy(
  inputPath: string,
  duration: number,
  onProgress?: (progress: { progress: number }) => void,
): Promise<{ success: boolean; proxyPath?: string; cached?: boolean; error?: string }> {
  return new Promise((resolve) => {
    const ffmpegPath = getFFmpegPath()
    if (!ffmpegPath) {
      resolve({ success: false, error: 'FFmpeg nicht gefunden' })
      return
    }

    // Path-Traversal-Schutz (fix #120)
    const safeInputPath = path.resolve(inputPath)
    const homeDir = os.homedir()
    const tmpDirPath = os.tmpdir()
    if (
      !safeInputPath.startsWith(homeDir + path.sep) &&
      !safeInputPath.startsWith(tmpDirPath + path.sep)
    ) {
      resolve({ success: false, error: 'Access denied: video path outside allowed directories' })
      return
    }

    // Cache-Hit pruefen
    const existingProxy = getExistingProxy(inputPath)
    if (existingProxy) {
      resolve({ success: true, proxyPath: existingProxy, cached: true })
      return
    }

    const proxyDir = _getProxyDir()
    const outputPath = path.join(proxyDir, _getProxyFileName(inputPath))

    const args = [
      '-i', inputPath,
      '-vf', PROXY_CONFIG.VIDEO_FILTER,
      '-c:v', 'libx264',
      '-pix_fmt', PROXY_CONFIG.PIX_FMT,
      '-preset', PROXY_CONFIG.PRESET,
      '-crf', PROXY_CONFIG.CRF,
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ]

    const proc = spawn(ffmpegPath, args)
    transcodingProcess = proc

    // Nur letzten Chunk-Rest aufbewahren fuer Grenzfaelle
    let chunkTail = ''

    proc.stderr!.on('data', (data: Buffer) => {
      const chunk = chunkTail + data.toString()

      if (duration > 0 && onProgress) {
        const timeMatch = chunk.match(/time=(\d+):(\d+):([\d.]+)/g)
        if (timeMatch) {
          const lastMatch = timeMatch[timeMatch.length - 1]
          const parts = lastMatch.match(/time=(\d+):(\d+):([\d.]+)/)
          if (parts) {
            const hours = parseInt(parts[1])
            const minutes = parseInt(parts[2])
            const seconds = parseFloat(parts[3])
            const currentTime = hours * 3600 + minutes * 60 + seconds
            const progress = Math.min((currentTime / duration) * 100, 99)
            onProgress({ progress: Math.round(progress) })
          }
        }
      }

      chunkTail = chunk.slice(-100)
    })

    proc.on('close', (code: number | null) => {
      if (transcodingProcess === proc) {
        transcodingProcess = null
      }

      if (code === 0) {
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          resolve({ success: true, proxyPath: outputPath })
        } else {
          resolve({ success: false, error: 'Proxy-Datei ist leer oder fehlt' })
        }
      } else {
        _cleanupFile(outputPath)
        resolve({
          success: false,
          error: code === null ? 'Transcoding abgebrochen' : `FFmpeg Fehler (Code ${code})`,
        })
      }
    })

    proc.on('error', (error: Error) => {
      if (transcodingProcess === proc) {
        transcodingProcess = null
      }
      _cleanupFile(outputPath)
      resolve({ success: false, error: `FFmpeg Fehler: ${error.message}` })
    })
  })
}

// Laufendes Transcoding abbrechen
export function cancelTranscoding(): void {
  const proc = transcodingProcess
  transcodingProcess = null
  if (proc) {
    try {
      proc.kill('SIGTERM')
    } catch (error) {
      console.error('Fehler beim Abbrechen des Transcodings:', error)
    }
  }
}

// Alle Proxy-Dateien aufraeumen (bei App-Quit)
export function cleanupProxies(): void {
  const proxyDir = path.join(os.tmpdir(), PROXY_CONFIG.TEMP_DIR_NAME)
  try {
    fs.rmSync(proxyDir, { recursive: true, force: true })
  } catch (error) {
    console.error('Fehler beim Aufraeumen der Proxies:', error)
  }
}

// Einzelne Datei loeschen ohne Fehler zu werfen
function _cleanupFile(filePath: string): void {
  try {
    fs.unlinkSync(filePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Fehler beim Loeschen:', filePath, error)
    }
  }
}

export default {
  needsTranscoding,
  generateProxy,
  cancelTranscoding,
  cleanupProxies,
  getExistingProxy,
}
