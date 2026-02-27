const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const ffmpegBridge = require('./ffmpegBridge');
const { EXPORT_CODECS } = require('../shared/constants');

// Validate export path is inside base directory
function isPathInsideBase(basePath, targetPath) {
  const base = path.resolve(basePath);
  const target = path.resolve(targetPath);
  return target.startsWith(base + path.sep) || target === base;
}

// Export video sequence (clip)
function exportSequence(videoPath, startTime, endTime, outputPath, codec, onProgress) {
  return new Promise((resolve) => {
    try {
      // Validate paths
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        resolve({
          success: false,
          error: 'Output directory does not exist',
        });
        return;
      }

      const ffmpegPath = ffmpegBridge.getFFmpegPath();
      if (!ffmpegPath) {
        resolve({ success: false, error: 'ffmpeg not found' });
        return;
      }

      const codecPreset = EXPORT_CODECS[codec] || EXPORT_CODECS.H264;
      const duration = endTime - startTime;

      const args = [
        '-ss', String(startTime),
        '-i', videoPath,
        '-t', String(duration),
        ...codecPreset.args,
        outputPath,
      ];

      const ffmpeg = spawn(ffmpegPath, args);

      let lastReportedProgress = 0;

      // Parse progress from stderr
      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();

        // Look for time= in progress output
        const timeMatch = output.match(/time=([\d:]+)/);
        if (timeMatch && onProgress) {
          const timeStr = timeMatch[1];
          const [hours, minutes, seconds] = timeStr.split(':').map(Number);
          const currentTime = hours * 3600 + minutes * 60 + seconds;
          const progress = Math.min((currentTime / duration) * 100, 100);

          if (progress - lastReportedProgress > 1) {
            onProgress({
              progress,
              currentTime,
              duration,
            });
            lastReportedProgress = progress;
          }
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            outputPath,
            duration,
          });
        } else {
          resolve({
            success: false,
            error: `ffmpeg failed with code ${code}`,
          });
        }
      });

      ffmpeg.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
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

// Export thumbnails as ZIP archive
function exportZip(thumbnailPaths, outputPath, onProgress) {
  return new Promise((resolve) => {
    try {
      // Validate output directory
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        resolve({
          success: false,
          error: 'Output directory does not exist',
        });
        return;
      }

      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 6 } });

      let totalSize = 0;
      let addedSize = 0;

      // Calculate total size for progress
      thumbnailPaths.forEach((thumbPath) => {
        if (fs.existsSync(thumbPath)) {
          const stats = fs.statSync(thumbPath);
          totalSize += stats.size;
        }
      });

      output.on('close', () => {
        resolve({
          success: true,
          outputPath,
          fileSize: archive.pointer(),
        });
      });

      archive.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
        });
      });

      archive.on('entry', (entry) => {
        if (fs.existsSync(entry.sourcePath)) {
          const stats = fs.statSync(entry.sourcePath);
          addedSize += stats.size;

          if (onProgress && totalSize > 0) {
            onProgress({
              progress: (addedSize / totalSize) * 100,
              addedSize,
              totalSize,
            });
          }
        }
      });

      archive.pipe(output);

      // Add files to archive
      thumbnailPaths.forEach((thumbPath) => {
        if (fs.existsSync(thumbPath)) {
          const filename = path.basename(thumbPath);
          archive.file(thumbPath, { name: filename });
        }
      });

      archive.finalize();
    } catch (error) {
      resolve({
        success: false,
        error: error.message,
      });
    }
  });
}

module.exports = {
  exportSequence,
  exportZip,
  isPathInsideBase,
};
