import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { startJob, JobError } from './ffmpegJobManager'
import { PROXY_CONFIG } from '../shared/constants'
import { validateForRead } from './pathSecurity'

// Aktiver Transcoding-Job — ersetzt das alte globale `let transcodingProcess`
// Vorteil: eindeutige Job-ID statt Prozess-Referenz, kein Race beim schnellen Doppelklick
import type { JobHandle } from './ffmpegJobManager'

let _activeTranscodeJob: JobHandle | null = null

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
    // Laufendes Transcoding abbrechen bevor neuer Prozess startet (fix #122)
    cancelTranscoding()

    // Path-Traversal-Schutz — Symlink-sicher via pathSecurity-Modul (fix #88, #120)
    let safeInputPath: string
    try {
      safeInputPath = validateForRead(inputPath, { allowTmp: true })
    } catch {
      resolve({ success: false, error: 'Access denied: video path not found or outside allowed directories' })
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
      '-i', safeInputPath,
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

    // Transcoding-Progress: nur wenn duration > 0 und Callback vorhanden
    const progressCallback =
      duration > 0 && onProgress
        ? (data: { progress: number } | undefined) => {
            if (data) onProgress(data)
          }
        : undefined

    const job = startJob({
      type: 'transcode',
      args,
      duration,
      onProgress: progressCallback,
    })

    _activeTranscodeJob = job

    job.done
      .then(() => {
        // Job-Referenz nur loeschen wenn dies noch der aktive Job ist
        if (_activeTranscodeJob === job) {
          _activeTranscodeJob = null
        }

        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          resolve({ success: true, proxyPath: outputPath })
        } else {
          resolve({ success: false, error: 'Proxy-Datei ist leer oder fehlt' })
        }
      })
      .catch((err: unknown) => {
        if (_activeTranscodeJob === job) {
          _activeTranscodeJob = null
        }
        _cleanupFile(outputPath)

        // Typisierte Fehlerklassifikation via JobError.kind (kein fragiles String-Matching)
        if (err instanceof JobError) {
          if (err.kind === 'cancelled') {
            resolve({ success: false, error: 'Transcoding abgebrochen' })
          } else if (err.kind === 'ffmpeg-not-found') {
            resolve({ success: false, error: 'FFmpeg nicht gefunden' })
          } else if (err.code !== undefined) {
            // kind='failed' mit Exit-Code: JobManager liefert bereits "FFmpeg Fehler (Code N)"
            resolve({ success: false, error: err.message })
          } else {
            // kind='failed' ohne Exit-Code: spawn-Error (ENOENT o.ae.) — Fehlertext ergaenzen
            resolve({ success: false, error: `FFmpeg Fehler: ${err.message}` })
          }
        } else {
          // Unbekannter Fehler (z.B. synchroner Wurf)
          const msg = (err as Error).message || String(err)
          resolve({ success: false, error: `FFmpeg Fehler: ${msg}` })
        }
      })
  })
}

// Laufendes Transcoding abbrechen
export function cancelTranscoding(): void {
  const job = _activeTranscodeJob
  _activeTranscodeJob = null
  if (job) {
    job.kill()
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
