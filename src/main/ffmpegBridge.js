const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { app } = require('electron');

// Modul-Level Cache — verhindert wiederholtes execFileSync beim Pfad-Lookup (fix #107/#69)
let _cachedFFmpegPath = undefined;
let _cachedFFprobePath = undefined;

// Get bundled ffmpeg path
function getBundledFFmpegPath() {
  const bundledPath = path.join(process.resourcesPath || app.getAppPath(), 'ffmpeg');
  const exeName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const fullPath = path.join(bundledPath, exeName);

  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  return null;
}

// Get system ffmpeg via which/where
function getSystemFFmpegPath() {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    // Nur erste Zeile verwenden — Windows 'where' gibt mehrere Treffer zurück (fix #157)
    const result = execFileSync(cmd, ['ffmpeg'], { encoding: 'utf8' }).split('\n')[0].trim();
    return result || null;
  } catch (error) {
    return null;
  }
}

// Check macOS Homebrew paths
function getMacOSFFmpegPath() {
  if (process.platform !== 'darwin') {
    return null;
  }

  const brewPaths = [
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/opt/homebrew/opt/ffmpeg/bin/ffmpeg',
  ];

  for (const brewPath of brewPaths) {
    if (fs.existsSync(brewPath)) {
      return brewPath;
    }
  }
  return null;
}

// Get ffmpeg path with fallback chain
function getFFmpegPath() {
  // Cache-Treffer zurückgeben — verhindert mehrfaches Suchen (fix #107/#69)
  if (_cachedFFmpegPath !== undefined) return _cachedFFmpegPath;

  // Try bundled first
  let ffmpegPath = getBundledFFmpegPath();
  if (ffmpegPath) {
    _cachedFFmpegPath = ffmpegPath;
    return _cachedFFmpegPath;
  }

  // Try macOS Homebrew
  ffmpegPath = getMacOSFFmpegPath();
  if (ffmpegPath) {
    _cachedFFmpegPath = ffmpegPath;
    return _cachedFFmpegPath;
  }

  // Try system PATH
  ffmpegPath = getSystemFFmpegPath();
  if (ffmpegPath) {
    _cachedFFmpegPath = ffmpegPath;
    return _cachedFFmpegPath;
  }

  _cachedFFmpegPath = null;
  return null;
}

// Get ffprobe path (same logic as ffmpeg)
function getFFprobePath() {
  // Cache-Treffer zurückgeben — verhindert mehrfaches Suchen (fix #107/#69)
  if (_cachedFFprobePath !== undefined) return _cachedFFprobePath;

  const bundledPath = path.join(process.resourcesPath || app.getAppPath(), 'ffmpeg');
  const exeName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
  let fullPath = path.join(bundledPath, exeName);

  if (fs.existsSync(fullPath)) {
    _cachedFFprobePath = fullPath;
    return _cachedFFprobePath;
  }

  // Try macOS Homebrew
  if (process.platform === 'darwin') {
    const brewPaths = [
      '/opt/homebrew/bin/ffprobe',
      '/usr/local/bin/ffprobe',
      '/opt/homebrew/opt/ffmpeg/bin/ffprobe',
    ];

    for (const brewPath of brewPaths) {
      if (fs.existsSync(brewPath)) {
        _cachedFFprobePath = brewPath;
        return _cachedFFprobePath;
      }
    }
  }

  // Try system PATH
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    // Nur erste Zeile verwenden — Windows 'where' gibt mehrere Treffer zurück (fix #157)
    const result = execFileSync(cmd, ['ffprobe'], { encoding: 'utf8' }).split('\n')[0].trim();
    if (result) {
      _cachedFFprobePath = result;
      return _cachedFFprobePath;
    }
  } catch (error) {
    // Continue to null
  }

  _cachedFFprobePath = null;
  return null;
}

// Validate ffmpeg installation and get version
function validateFFmpeg() {
  try {
    const ffmpegPath = getFFmpegPath();
    const ffprobePath = getFFprobePath();

    if (!ffmpegPath || !ffprobePath) {
      return {
        available: false,
        version: null,
        path: null,
        error: 'ffmpeg or ffprobe not found',
      };
    }

    // Get version
    const versionOutput = execFileSync(ffmpegPath, ['-version'], { encoding: 'utf8' });
    const versionMatch = versionOutput.match(/ffmpeg version ([\w\d.]+)/);
    const version = versionMatch ? versionMatch[1] : 'unknown';

    return {
      available: true,
      version,
      path: ffmpegPath,
    };
  } catch (error) {
    return {
      available: false,
      version: null,
      path: null,
      error: error.message,
    };
  }
}

module.exports = {
  getFFmpegPath,
  getFFprobePath,
  validateFFmpeg,
};
