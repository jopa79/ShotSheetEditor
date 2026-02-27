const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { app } = require('electron');

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
    const cmd = process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg';
    const result = execSync(cmd, { encoding: 'utf8' }).trim();
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
  // Try bundled first
  let ffmpegPath = getBundledFFmpegPath();
  if (ffmpegPath) {
    return ffmpegPath;
  }

  // Try macOS Homebrew
  ffmpegPath = getMacOSFFmpegPath();
  if (ffmpegPath) {
    return ffmpegPath;
  }

  // Try system PATH
  ffmpegPath = getSystemFFmpegPath();
  if (ffmpegPath) {
    return ffmpegPath;
  }

  return null;
}

// Get ffprobe path (same logic as ffmpeg)
function getFFprobePath() {
  const bundledPath = path.join(process.resourcesPath || app.getAppPath(), 'ffmpeg');
  const exeName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
  let fullPath = path.join(bundledPath, exeName);

  if (fs.existsSync(fullPath)) {
    return fullPath;
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
        return brewPath;
      }
    }
  }

  // Try system PATH
  try {
    const cmd = process.platform === 'win32' ? 'where ffprobe' : 'which ffprobe';
    const result = execSync(cmd, { encoding: 'utf8' }).trim();
    if (result) {
      return result;
    }
  } catch (error) {
    // Continue to null
  }

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
    const versionCmd = `"${ffmpegPath}" -version`;
    const versionOutput = execSync(versionCmd, { encoding: 'utf8' });
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
