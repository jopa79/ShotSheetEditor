const { spawn } = require('child_process');
const ffmpegBridge = require('./ffmpegBridge');
const { secondsToTimecode } = require('../shared/constants');

let detectionProcess = null;

// Detect scenes in video
function detectScenes(videoPath, threshold, onProgress) {
  // Cancel any ongoing detection before starting a new one
  cancelDetection();

  return new Promise((resolve) => {
    try {
      const ffmpegPath = ffmpegBridge.getFFmpegPath();
      if (!ffmpegPath) {
        resolve({ success: false, error: 'ffmpeg not found' });
        return;
      }

      // Validate threshold to prevent injection into ffmpeg filter
      const safeThreshold = Math.max(0.01, Math.min(1.0, parseFloat(threshold) || 0.3));

      const scenes = [];
      let totalDuration = 0;
      let processedTime = 0;

      // ffmpeg command: detect scene changes
      const args = [
        '-i', videoPath,
        '-vf', `select='gt(scene,${safeThreshold})',showinfo`,
        '-vsync', 'vfr',
        '-f', 'null',
        '-',
      ];

      detectionProcess = spawn(ffmpegPath, args);

      let lineBuffer = '';
      const seenTimes = new Set();

      // Parse stderr for scene detection output — process only new lines
      detectionProcess.stderr.on('data', (data) => {
        lineBuffer += data.toString();

        // Split into complete lines; keep incomplete last chunk in buffer
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          // Extract duration from first occurrence
          if (totalDuration === 0) {
            const durationMatch = line.match(/Duration: (\d+):(\d+):([\d.]+)/);
            if (durationMatch) {
              const hours = parseInt(durationMatch[1]);
              const minutes = parseInt(durationMatch[2]);
              const seconds = parseFloat(durationMatch[3]);
              totalDuration = hours * 3600 + minutes * 60 + seconds;
            }
          }

          // Extract scene timestamps from showinfo output
          if (line.includes('pts_time:')) {
            const match = line.match(/pts_time:([\d.]+)/);
            if (match) {
              const time = parseFloat(match[1]);
              if (!seenTimes.has(time)) {
                seenTimes.add(time);
                scenes.push({
                  index: scenes.length,
                  startTime: time,
                  tc: secondsToTimecode(time),
                });
              }
              processedTime = Math.max(processedTime, time);
            }
          }

          // Track progress from frame info lines
          if (line.includes('[Parsed_showinfo') && line.includes('pkt_pts_time=')) {
            const match = line.match(/pkt_pts_time=([\d.]+)/);
            if (match) {
              processedTime = Math.max(processedTime, parseFloat(match[1]));
            }
          }
        }

        // Report progress
        if (totalDuration > 0 && onProgress) {
          const progress = Math.min((processedTime / totalDuration) * 100, 100);
          onProgress({
            progress,
            processedTime,
            totalDuration,
            scenesDetected: scenes.length,
          });
        }
      });

      detectionProcess.stdout.on('data', (data) => {
        // Ignore stdout (null format)
      });

      detectionProcess.on('close', (code) => {
        detectionProcess = null;

        if (code === 0 || code === null) {
          resolve({
            success: true,
            scenes,
          });
        } else {
          resolve({
            success: false,
            error: `ffmpeg failed with code ${code}`,
          });
        }
      });

      detectionProcess.on('error', (error) => {
        detectionProcess = null;
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

// Cancel ongoing detection
function cancelDetection() {
  if (detectionProcess) {
    try {
      detectionProcess.kill('SIGTERM');
      detectionProcess = null;
    } catch (error) {
      console.error('Error cancelling detection:', error);
    }
  }
}

module.exports = {
  detectScenes,
  cancelDetection,
};
