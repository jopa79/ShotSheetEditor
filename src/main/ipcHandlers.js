const { ipcMain } = require('electron');
const path = require('path');
const { IPC_CHANNELS } = require('../shared/constants');
const videoManager = require('./videoManager');
const sceneDetector = require('./sceneDetector');
const frameExtractor = require('./frameExtractor');
const exportManager = require('./exportManager');
const projectManager = require('./projectManager');
const dialogManager = require('./dialogManager');
const windowManager = require('./windowManager');
const { getFFmpegPath, validateFFmpeg } = require('./ffmpegBridge');
const proxyGenerator = require('./proxyGenerator');

// Helper: Wrap handler with try/catch
function wrapHandler(handler) {
  return async (event, ...args) => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      console.error('IPC handler error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  };
}

// Helper: Validate string input
function validateString(value, name) {
  if (!value || typeof value !== 'string') {
    throw new Error(`Invalid ${name}: expected a non-empty string`);
  }
  return value;
}

// Helper: Validate numeric input within range
function validateNumber(value, min, max, fallback, name) {
  const num = parseFloat(value);
  if (!Number.isFinite(num)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Invalid ${name}: expected a number`);
  }
  return Math.max(min, Math.min(max, num));
}

// Helper: Validate thumbSize dimensions
function validateThumbSize(thumbSize) {
  if (!thumbSize || typeof thumbSize !== 'object') return undefined;
  return {
    width: validateNumber(thumbSize.width, 32, 3840, 320, 'thumbSize.width'),
    height: validateNumber(thumbSize.height, 32, 2160, 180, 'thumbSize.height'),
  };
}

// Helper: Send progress updates from main to renderer
function sendProgress(mainWindow, channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function registerIpcHandlers(mainWindow) {
  // Video operations
  ipcMain.handle(
    IPC_CHANNELS.VIDEO_OPEN,
    wrapHandler(async (event, filePath) => {
      validateString(filePath, 'filePath');
      const meta = await videoManager.getVideoMeta(filePath);
      if (!meta || !meta.success) {
        return { success: false, error: meta?.error || 'Failed to open video' };
      }
      return { success: true, path: filePath, meta };
    }),
  );

  ipcMain.handle(
    IPC_CHANNELS.VIDEO_GET_META,
    wrapHandler(async (event, videoPath) => {
      validateString(videoPath, 'videoPath');
      const result = await videoManager.getVideoMeta(videoPath);
      // Proxy-Entscheidung im Main-Prozess treffen (Single Source of Truth)
      if (result?.success && result?.data) {
        result.data.needsProxy = proxyGenerator.needsTranscoding(
          result.data.codec,
          videoPath,
        );
      }
      return result;
    }),
  );

  // Scene detection
  ipcMain.handle(
    IPC_CHANNELS.SCENE_DETECT,
    wrapHandler(async (event, { videoPath, threshold }) => {
      validateString(videoPath, 'videoPath');
      const safeThreshold = validateNumber(threshold, 0.01, 1.0, 0.3, 'threshold');
      return sceneDetector.detectScenes(videoPath, safeThreshold, (progress) => {
        sendProgress(mainWindow, IPC_CHANNELS.SCENE_DETECT_PROGRESS, progress);
      });
    }),
  );

  ipcMain.handle(IPC_CHANNELS.SCENE_DETECT_CANCEL, () => {
    sceneDetector.cancelDetection();
    return { success: true };
  });

  // Frame extraction
  ipcMain.handle(
    IPC_CHANNELS.FRAME_EXTRACT_BATCH,
    wrapHandler(async (event, { videoPath, scenes, outputDir, thumbSize }) => {
      validateString(videoPath, 'videoPath');
      validateString(outputDir, 'outputDir');
      if (!Array.isArray(scenes)) {
        throw new Error('Invalid scenes: expected an array');
      }
      const safeThumbSize = validateThumbSize(thumbSize);
      return frameExtractor.extractFrames(videoPath, scenes, outputDir, safeThumbSize, (progress) => {
        sendProgress(mainWindow, IPC_CHANNELS.FRAME_EXTRACT_PROGRESS, progress);
      });
    }),
  );

  // Thumbnail retrieval — returns base64 data for a single thumb file
  ipcMain.handle(
    IPC_CHANNELS.FRAME_GET_THUMB,
    wrapHandler(async (event, thumbPath) => {
      const fs = require('fs');
      const os = require('os');

      // Validate thumbPath is a string
      if (!thumbPath || typeof thumbPath !== 'string') {
        return { success: false, error: 'Invalid thumbnail path' };
      }

      // Validate file extension
      const ext = path.extname(thumbPath).toLowerCase();
      if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
        return { success: false, error: 'Invalid file type' };
      }

      // Resolve and validate path is within allowed directories
      const resolved = path.resolve(thumbPath);
      const homeDir = os.homedir();
      const tmpDir = os.tmpdir();
      const isAllowed =
        resolved.startsWith(homeDir + path.sep) ||
        resolved.startsWith(tmpDir + path.sep);
      if (!isAllowed) {
        return { success: false, error: 'Access denied: path outside allowed directories' };
      }

      if (!fs.existsSync(resolved)) {
        return { success: false, error: 'Thumbnail not found' };
      }
      const data = await fs.promises.readFile(resolved);
      const base64 = data.toString('base64');
      return { success: true, data: `data:image/jpeg;base64,${base64}` };
    }),
  );

  // Project management
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_NEW,
    wrapHandler(async (event, { name, videoPath }) => {
      const result = projectManager.newProject(name, videoPath);
      return result;
    }),
  );

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_OPEN,
    wrapHandler(async (event, projectPath) => {
      const result = projectManager.openProject(projectPath);
      return result;
    }),
  );

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_SAVE,
    wrapHandler(async (event, { projectPath, data }) => {
      validateString(projectPath, 'projectPath');
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid project data');
      }
      const result = projectManager.saveProject(projectPath, data);
      return result;
    }),
  );

  // Export operations
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_SEQUENCE,
    wrapHandler(async (event, data) => {
      const { videoPath, startTime, endTime, outputPath, codec } = data;
      return exportManager.exportSequence(videoPath, startTime, endTime, outputPath, codec, (progress) => {
        sendProgress(mainWindow, IPC_CHANNELS.EXPORT_SEQUENCE_PROGRESS, progress);
      });
    }),
  );

  ipcMain.handle(
    IPC_CHANNELS.EXPORT_ZIP,
    wrapHandler(async (event, data) => {
      const { thumbnailPaths, outputPath } = data;
      return exportManager.exportZip(thumbnailPaths, outputPath, (progress) => {
        sendProgress(mainWindow, IPC_CHANNELS.EXPORT_SEQUENCE_PROGRESS, progress);
      });
    }),
  );

  ipcMain.handle(IPC_CHANNELS.EXPORT_SELECT_DIR, async () => {
    try {
      const result = await dialogManager.showExportDirDialog();
      if (result.canceled) {
        return { success: false, error: 'Canceled' };
      }
      return { success: true, path: result.filePaths[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Theme management
  ipcMain.handle(IPC_CHANNELS.THEME_TOGGLE, () => {
    try {
      const theme = windowManager.toggleTheme();
      return { success: true, theme };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.THEME_GET, () => {
    try {
      const theme = windowManager.getThemeSource();
      return { success: true, theme };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // App information
  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    try {
      const { app } = require('electron');
      const ffmpegInfo = validateFFmpeg();
      return {
        success: true,
        version: app.getVersion(),
        ffmpeg: ffmpegInfo,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Dialogs
  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_VIDEO, async () => {
    try {
      const result = await dialogManager.showOpenVideoDialog();
      if (result.canceled) {
        return { success: false, error: 'Canceled' };
      }
      return { success: true, path: result.filePaths[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Proxy transcoding
  ipcMain.handle(
    IPC_CHANNELS.PROXY_GENERATE,
    wrapHandler(async (event, { videoPath, duration }) => {
      const result = await proxyGenerator.generateProxy(videoPath, duration, (progress) => {
        sendProgress(mainWindow, IPC_CHANNELS.PROXY_GENERATE_PROGRESS, progress);
      });
      return result;
    }),
  );

  ipcMain.handle(IPC_CHANNELS.PROXY_CANCEL, () => {
    proxyGenerator.cancelTranscoding();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG_UNSAVED_CHANGES, async () => {
    try {
      const response = await dialogManager.showUnsavedChangesDialog();
      return { success: true, response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = {
  registerIpcHandlers,
};
