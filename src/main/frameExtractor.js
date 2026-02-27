const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpegBridge = require('./ffmpegBridge');
const { THUMB_SIZE, secondsToTimecode } = require('../shared/constants');

const MAX_CONCURRENT_EXTRACTIONS = 5;

// Extract single frame
function extractFrame(videoPath, timestamp, outputPath, thumbSize) {
  return new Promise((resolve) => {
    try {
      const ffmpegPath = ffmpegBridge.getFFmpegPath();
      if (!ffmpegPath) {
        resolve({ success: false, error: 'ffmpeg not found' });
        return;
      }

      const args = [
        '-ss', String(timestamp),
        '-i', videoPath,
        '-vframes', '1',
        '-vf', `scale=${thumbSize.width}:${thumbSize.height}:force_original_aspect_ratio=decrease,pad=${thumbSize.width}:${thumbSize.height}:(ow-iw)/2:(oh-ih)/2`,
        '-q:v', '4',
        outputPath,
      ];

      const ffmpeg = spawn(ffmpegPath, args);

      ffmpeg.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve({ success: true, path: outputPath });
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

// Extract multiple frames with concurrency
async function extractFrames(videoPath, scenes, outputDir, thumbSize, onProgress) {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    if (scenes.length === 0) {
      return { success: true, frames: [] };
    }

    const frames = [];
    const queue = scenes.map((scene, idx) => ({
      index: idx,
      scene,
    }));

    let processing = 0;
    let completed = 0;

    return new Promise((resolve) => {
      const processNext = async () => {
        if (queue.length === 0 && processing === 0) {
          if (onProgress) {
            onProgress({ progress: 100, completed: scenes.length, total: scenes.length });
          }
          resolve({ success: true, frames });
          return;
        }

        if (processing >= MAX_CONCURRENT_EXTRACTIONS || queue.length === 0) {
          return;
        }

        const task = queue.shift();
        processing++;

        try {
          const filename = `frame_${String(task.scene.index).padStart(4, '0')}.jpg`;
          const outputPath = path.join(outputDir, filename);

          const result = await extractFrame(
            videoPath,
            task.scene.startTime,
            outputPath,
            thumbSize || THUMB_SIZE,
          );

          if (result.success) {
            frames[task.index] = {
              index: task.scene.index,
              path: outputPath,
              timestamp: task.scene.startTime,
              tc: task.scene.tc,
            };
          } else {
            console.error(`Failed to extract frame ${task.scene.index}:`, result.error);
          }

          completed++;

          if (onProgress) {
            onProgress({
              progress: (completed / scenes.length) * 100,
              completed,
              total: scenes.length,
            });
          }
        } catch (error) {
          console.error('Error extracting frame:', error);
        } finally {
          processing--;
          processNext();
        }
      };

      // Start initial batch
      for (let i = 0; i < MAX_CONCURRENT_EXTRACTIONS; i++) {
        processNext();
      }
    });
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  extractFrames,
  extractFrame,
};
