const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegBridge = require('./ffmpegBridge');
const { SUPPORTED_FORMATS } = require('../shared/constants');

const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024 * 1024; // 50 GB

// Safely parse ffprobe fraction strings like "30000/1001" or "30"
function parseFraction(str) {
  if (!str || typeof str !== 'string') return 0;
  const parts = str.split('/');
  const numerator = parseFloat(parts[0]);
  if (parts.length === 2) {
    const denominator = parseFloat(parts[1]);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
    return numerator / denominator;
  }
  return Number.isFinite(numerator) ? numerator : 0;
}

// Validate video file
function validateVideo(videoPath) {
  try {
    // Check file exists
    if (!fs.existsSync(videoPath)) {
      return { valid: false, error: 'File does not exist' };
    }

    // Check extension
    const ext = path.extname(videoPath).toLowerCase();
    if (!SUPPORTED_FORMATS.includes(ext)) {
      return {
        valid: false,
        error: `Unsupported format. Supported: ${SUPPORTED_FORMATS.join(', ')}`,
      };
    }

    // Check file size
    const stats = fs.statSync(videoPath);
    if (stats.size > MAX_VIDEO_SIZE_BYTES) {
      return { valid: false, error: 'File too large (max 50 GB)' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Get video metadata via ffprobe
function getVideoMeta(videoPath) {
  return new Promise((resolve) => {
    try {
      // Validate first
      const validation = validateVideo(videoPath);
      if (!validation.valid) {
        resolve({ success: false, error: validation.error });
        return;
      }

      const ffprobePath = ffmpegBridge.getFFprobePath();
      if (!ffprobePath) {
        resolve({ success: false, error: 'ffprobe not found' });
        return;
      }

      const ffprobe = spawn(ffprobePath, [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath,
      ]);

      let stdout = '';
      let stderr = '';

      ffprobe.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffprobe.on('close', (code) => {
        try {
          if (code !== 0) {
            resolve({
              success: false,
              error: `ffprobe failed: ${stderr || 'unknown error'}`,
            });
            return;
          }

          const data = JSON.parse(stdout);
          const format = data.format || {};
          const videoStream = (data.streams || []).find((s) => s.codec_type === 'video');
          const audioStream = (data.streams || []).find((s) => s.codec_type === 'audio');

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
          });
        } catch (error) {
          resolve({
            success: false,
            error: `Failed to parse metadata: ${error.message}`,
          });
        }
      });

      ffprobe.on('error', (error) => {
        resolve({
          success: false,
          error: `ffprobe error: ${error.message}`,
        });
      });
    } catch (error) {
      resolve({
        success: false,
        error: error.message,
      });
    }
  });
}

module.exports = {
  getVideoMeta,
  validateVideo,
};
