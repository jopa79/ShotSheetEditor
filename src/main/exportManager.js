const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const ffmpegBridge = require('./ffmpegBridge');
const { EXPORT_CODECS } = require('../shared/constants');

// Export video sequence (clip)
function exportSequence(videoPath, startTime, endTime, outputPath, codec, onProgress) {
  return new Promise((resolve) => {
    try {
      // Path-Traversal-Schutz: Pfade gegen homeDir/tmpDir validieren (fix #117)
      const os = require('os');
      const homeDir = os.homedir();
      const tmpDir = os.tmpdir();
      const resolvedVideoPath = path.resolve(videoPath);
      const resolvedOutputPath = path.resolve(outputPath);
      if (!resolvedVideoPath.startsWith(homeDir + path.sep) && !resolvedVideoPath.startsWith(tmpDir + path.sep)) {
        resolve({ success: false, error: 'Access denied: video path outside allowed directories' });
        return;
      }
      if (!resolvedOutputPath.startsWith(homeDir + path.sep)) {
        resolve({ success: false, error: 'Access denied: output path must be within home directory' });
        return;
      }

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

      // Ungültige Zeitbereiche abfangen — verhindert NaN/negative Duration (fix #129)
      if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
        resolve({ success: false, error: 'Invalid time range: start must be before end' });
        return;
      }
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

// Export thumbnails as ZIP archive (fix #160: async statt sync I/O)
async function exportZip(thumbnailPaths, outputPath, onProgress) {
  try {
    // Validate output directory (async statt existsSync — fix #160)
    const outputDir = path.dirname(outputPath);
    try {
      await fs.promises.access(outputDir);
    } catch {
      return { success: false, error: 'Output directory does not exist' };
    }

    // Validate thumbnail paths asynchronously (fix #160)
    const os = require('os');
    const homeDir = os.homedir();
    const tmpDir = os.tmpdir();
    const validPaths = [];
    for (const thumbPath of thumbnailPaths) {
      if (typeof thumbPath !== 'string') continue;
      const resolved = path.resolve(thumbPath);
      const isAllowed =
        resolved.startsWith(homeDir + path.sep) ||
        resolved.startsWith(tmpDir + path.sep);
      if (!isAllowed) continue;
      try {
        await fs.promises.access(resolved);
        validPaths.push({ resolved, filename: path.basename(resolved) });
      } catch {
        // File doesn't exist — skip
      }
    }

    return new Promise((resolve) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 6 } });

      let resolvedFlag = false;
      const safeResolve = (result) => {
        if (!resolvedFlag) {
          resolvedFlag = true;
          resolve(result);
        }
      };

      output.on('close', () => {
        safeResolve({
          success: true,
          outputPath,
          fileSize: archive.pointer(),
        });
      });

      archive.on('error', (error) => {
        safeResolve({ success: false, error: error.message });
      });

      // archive.on('entry') liefert kein entry.sourcePath — stattdessen 'progress' verwenden (fix #92)
      archive.on('progress', (progressData) => {
        if (onProgress && progressData.fs.totalBytes > 0) {
          onProgress({
            progress: (progressData.fs.processedBytes / progressData.fs.totalBytes) * 100,
            processedBytes: progressData.fs.processedBytes,
            totalBytes: progressData.fs.totalBytes,
          });
        }
      });

      archive.pipe(output);

      for (const { resolved, filename } of validPaths) {
        archive.file(resolved, { name: filename });
      }

      archive.finalize();
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  exportSequence,
  exportZip,
};
