const { contextBridge, ipcRenderer } = require('electron');

// NOTE: Preload runs in sandbox — cannot import shared/constants.js
// Channel strings MUST match IPC_CHANNELS in src/shared/constants.js exactly
contextBridge.exposeInMainWorld('electronAPI', {
  // ===== Invoke methods (Renderer → Main, with response) =====

  // Video
  openVideo: (filePath) => ipcRenderer.invoke('video:open', filePath),
  getVideoMeta: (filePath) => ipcRenderer.invoke('video:getMeta', filePath),

  // Scene Detection
  detectScenes: (videoPath, threshold) => ipcRenderer.invoke('scene:detect', { videoPath, threshold }),
  cancelDetection: () => ipcRenderer.invoke('scene:detectCancel'),

  // Frame Extraction
  extractFrames: (videoPath, scenes, outputDir) => ipcRenderer.invoke('frame:extractBatch', { videoPath, scenes, outputDir }),
  getThumb: (thumbPath) => ipcRenderer.invoke('frame:getThumb', thumbPath),

  // Project
  newProject: (name, videoPath) => ipcRenderer.invoke('project:new', { name, videoPath }),
  openProject: (projectPath) => ipcRenderer.invoke('project:open', projectPath),
  saveProject: (projectPath, data) => ipcRenderer.invoke('project:save', { projectPath, data }),

  // Export
  exportSequence: (data) => ipcRenderer.invoke('export:sequence', data),
  exportZip: (data) => ipcRenderer.invoke('export:zip', data),
  selectExportDir: () => ipcRenderer.invoke('export:selectDir'),

  // Theme
  toggleTheme: () => ipcRenderer.invoke('theme:toggle'),
  getTheme: () => ipcRenderer.invoke('theme:get'),

  // App
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  confirmQuit: () => ipcRenderer.invoke('app:confirmQuit'),

  // Proxy
  generateProxy: (videoPath, duration) => ipcRenderer.invoke('proxy:generate', { videoPath, duration }),
  cancelProxy: () => ipcRenderer.invoke('proxy:cancel'),

  // Dialogs
  openVideoDialog: () => ipcRenderer.invoke('dialog:openVideo'),
  unsavedChangesDialog: () => ipcRenderer.invoke('dialog:unsavedChanges'),

  // ===== Listener methods (Main → Renderer, fire & forget) =====
  // Each returns a cleanup function that MUST be called on teardown

  onDetectProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('scene:detectProgress', handler);
    return () => ipcRenderer.removeListener('scene:detectProgress', handler);
  },

  onExtractProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('frame:extractProgress', handler);
    return () => ipcRenderer.removeListener('frame:extractProgress', handler);
  },

  onProxyProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('proxy:generateProgress', handler);
    return () => ipcRenderer.removeListener('proxy:generateProgress', handler);
  },

  onExportProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('export:sequenceProgress', handler);
    return () => ipcRenderer.removeListener('export:sequenceProgress', handler);
  },

  onThemeChanged: (callback) => {
    const handler = (_event, theme) => callback(theme);
    ipcRenderer.on('theme:changed', handler);
    return () => ipcRenderer.removeListener('theme:changed', handler);
  },

  onMenuAction: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on('menu:action', handler);
    return () => ipcRenderer.removeListener('menu:action', handler);
  },

  onBeforeQuit: (callback) => {
    const handler = (_event) => callback();
    ipcRenderer.on('app:beforeQuit', handler);
    return () => ipcRenderer.removeListener('app:beforeQuit', handler);
  },
});
