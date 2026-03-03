import path from 'path'
import fs from 'fs'
import { execFileSync } from 'child_process'
import { app } from 'electron'

// Modul-Level Cache — verhindert wiederholtes execFileSync beim Pfad-Lookup (fix #107/#69)
let _cachedFFmpegPath: string | null | undefined = undefined
let _cachedFFprobePath: string | null | undefined = undefined

export interface FFmpegValidation {
  available: boolean
  version: string | null
  path: string | null
  error?: string
}

// Gebundelter ffmpeg-Pfad pruefen
function getBundledFFmpegPath(): string | null {
  const bundledPath = path.join(process.resourcesPath || app.getAppPath(), 'ffmpeg')
  const exeName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const fullPath = path.join(bundledPath, exeName)

  if (fs.existsSync(fullPath)) {
    return fullPath
  }
  return null
}

// System-ffmpeg via which/where finden
function getSystemFFmpegPath(): string | null {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    // Nur erste Zeile verwenden — Windows 'where' gibt mehrere Treffer zurueck (fix #157)
    const result = execFileSync(cmd, ['ffmpeg'], { encoding: 'utf8' }).split('\n')[0].trim()
    return result || null
  } catch {
    return null
  }
}

// macOS Homebrew-Pfade pruefen
function getMacOSFFmpegPath(): string | null {
  if (process.platform !== 'darwin') {
    return null
  }

  const brewPaths = [
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/opt/homebrew/opt/ffmpeg/bin/ffmpeg',
  ]

  for (const brewPath of brewPaths) {
    if (fs.existsSync(brewPath)) {
      return brewPath
    }
  }
  return null
}

// ffmpeg-Pfad mit Fallback-Kette
export function getFFmpegPath(): string | null {
  // Cache-Treffer zurueckgeben (fix #107/#69)
  if (_cachedFFmpegPath !== undefined) return _cachedFFmpegPath

  let ffmpegPath = getBundledFFmpegPath()
  if (ffmpegPath) {
    _cachedFFmpegPath = ffmpegPath
    return _cachedFFmpegPath
  }

  ffmpegPath = getMacOSFFmpegPath()
  if (ffmpegPath) {
    _cachedFFmpegPath = ffmpegPath
    return _cachedFFmpegPath
  }

  ffmpegPath = getSystemFFmpegPath()
  if (ffmpegPath) {
    _cachedFFmpegPath = ffmpegPath
    return _cachedFFmpegPath
  }

  _cachedFFmpegPath = null
  return null
}

// ffprobe-Pfad (gleiche Logik wie ffmpeg)
export function getFFprobePath(): string | null {
  if (_cachedFFprobePath !== undefined) return _cachedFFprobePath

  const bundledPath = path.join(process.resourcesPath || app.getAppPath(), 'ffmpeg')
  const exeName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'
  const fullPath = path.join(bundledPath, exeName)

  if (fs.existsSync(fullPath)) {
    _cachedFFprobePath = fullPath
    return _cachedFFprobePath
  }

  // macOS Homebrew
  if (process.platform === 'darwin') {
    const brewPaths = [
      '/opt/homebrew/bin/ffprobe',
      '/usr/local/bin/ffprobe',
      '/opt/homebrew/opt/ffmpeg/bin/ffprobe',
    ]

    for (const brewPath of brewPaths) {
      if (fs.existsSync(brewPath)) {
        _cachedFFprobePath = brewPath
        return _cachedFFprobePath
      }
    }
  }

  // System PATH
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const result = execFileSync(cmd, ['ffprobe'], { encoding: 'utf8' }).split('\n')[0].trim()
    if (result) {
      _cachedFFprobePath = result
      return _cachedFFprobePath
    }
  } catch {
    // Weiter zu null
  }

  _cachedFFprobePath = null
  return null
}

// ffmpeg-Installation validieren und Version ermitteln
export function validateFFmpeg(): FFmpegValidation {
  try {
    const ffmpegPath = getFFmpegPath()
    const ffprobePath = getFFprobePath()

    if (!ffmpegPath || !ffprobePath) {
      return {
        available: false,
        version: null,
        path: null,
        error: 'ffmpeg or ffprobe not found',
      }
    }

    const versionOutput = execFileSync(ffmpegPath, ['-version'], { encoding: 'utf8' })
    const versionMatch = versionOutput.match(/ffmpeg version ([\w\d.]+)/)
    const version = versionMatch ? versionMatch[1] : 'unknown'

    return {
      available: true,
      version,
      path: ffmpegPath,
    }
  } catch (error) {
    return {
      available: false,
      version: null,
      path: null,
      error: (error as Error).message,
    }
  }
}

export default { getFFmpegPath, getFFprobePath, validateFFmpeg }
