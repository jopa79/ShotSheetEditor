const { ipcMain } = require('electron');
const { IPC_CHANNELS } = require('../shared/constants');
const videoManager = require('./videoManager');
const sceneDetector = require('./sceneDetector');
const frameExtractor = require('./frameExtractor');
const exportManager = require('./exportManager');
const projectManager = require('./projectManager');
const dialogManager = require('./dialogManager');
const windowManager = require('./windowManager');
const { getFFmpegPath, validateFFmpeg } = require('./ffmpegBridge');

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
      // Validate video file exists and get metadata
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
      const result = await videoManager.getVideoMeta(videoPath);
      return result;
    }),
  );

  // Scene detection
  ipcMain.handle(
    IPC_CHANNELS.SCENE_DETECT,
    wrapHandler(async (event, { videoPath, threshold }) => {
      return new Promise((resolve) => {
        sceneDetector.detectScenes(videoPath, threshold, (progress) => {
          sendProgress(mainWindow, IPC_CHANNELS.SCENE_DETECT_PROGRESS, progress);
        }).then((result) => {
          resolve(result);
        });
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
      return new Promise((resolve) => {
        frameExtractor
          .extractFrames(videoPath, scenes, outputDir, thumbSize, (progress) => {
            sendProgress(mainWindow, IPC_CHANNELS.FRAME_EXTRACT_PROGRESS, progress);
          })
          .then((result) => {
            resolve(result);
          });
      });
    }),
  );

  // Thumbnail retrieval — returns base64 data for a single thumb file
  ipcMain.handle(
    IPC_CHANNELS.FRAME_GET_THUMB,
    wrapHandler(async (event, thumbPath) => {
      const fs = require('fs');
      if (!fs.existsSync(thumbPath)) {
        return { success: false, error: 'Thumbnail not found' };
      }
      const data = fs.readFileSync(thumbPath);
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
      const result = projectManager.saveProject(projectPath, data);
      return result;
    }),
  );

  // Export operations
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_SEQUENCE,
    wrapHandler(async (event, data) => {
      const { videoPath, startTime, endTime, outputPath, codec } = data;
      return new Promise((resolve) => {
        exportManager
          .exportSequence(videoPath, startTime, endTime, outputPath, codec, (progress) => {
            sendProgress(mainWindow, IPC_CHANNELS.EXPORT_SEQUENCE_PROGRESS, progress);
          })
          .then((result) => {
            resolve(result);
          });
      });
    }),
  );

  ipcMain.handle(
    IPC_CHANNELS.EXPORT_ZIP,
    wrapHandler(async (event, data) => {
      const { thumbnailPaths, outputPath } = data;
      return new Promise((resolve) => {
        exportManager
          .exportZip(thumbnailPaths, outputPath, (progress) => {
            // Reuse sequence progress channel for ZIP progress updates
            sendProgress(mainWindow, IPC_CHANNELS.EXPORT_SEQUENCE_PROGRESS, progress);
          })
          .then((result) => {
            resolve(result);
          });
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
