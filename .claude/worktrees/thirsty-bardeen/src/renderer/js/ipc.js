/**
 * IPC Wrapper Module
 * Provides a clean API for renderer modules to communicate with main process
 * Wraps window.electronAPI methods exposed by preload.js
 *
 * IMPORTANT: Method names and signatures MUST match preload.js exactly.
 * preload.js listener methods (onXxx) return cleanup functions directly.
 */
const IPC = (() => {
  const api = window.electronAPI || {};

  return {
    // ===== Invoke methods (Renderer -> Main, with response) =====

    // Proxy
    generateProxy: (videoPath, duration) => api.generateProxy?.(videoPath, duration),
    cancelProxy: () => api.cancelProxy?.(),

    // Dialogs
    openVideoDialog: () => api.openVideoDialog?.(),
    unsavedChangesDialog: () => api.unsavedChangesDialog?.(),

    // Video
    openVideo: (filePath) => api.openVideo?.(filePath),
    getVideoMeta: (filePath) => api.getVideoMeta?.(filePath),

    // Scene Detection
    detectScenes: (videoPath, threshold) => api.detectScenes?.(videoPath, threshold),
    cancelDetection: () => api.cancelDetection?.(),

    // Frame Extraction
    extractFrames: (videoPath, scenes, outputDir) => api.extractFrames?.(videoPath, scenes, outputDir),
    getThumb: (thumbPath) => api.getThumb?.(thumbPath),

    // Project
    newProject: (name, videoPath) => api.newProject?.(name, videoPath),
    openProject: (projectPath) => api.openProject?.(projectPath),
    saveProject: (projectPath, data) => api.saveProject?.(projectPath, data),

    // Export
    exportSequence: (data) => api.exportSequence?.(data),
    exportZip: (data) => api.exportZip?.(data),
    selectExportDir: () => api.selectExportDir?.(),

    // Theme
    toggleTheme: () => api.toggleTheme?.(),
    getTheme: () => api.getTheme?.(),

    // App
    getVersion: () => api.getVersion?.(),
    confirmQuit: () => api.confirmQuit?.(),

    // ===== Listener methods (Main -> Renderer) =====
    // Each returns a cleanup function. Call it on teardown.

    onProxyProgress: (callback) => api.onProxyProgress?.(callback),
    onDetectProgress: (callback) => api.onDetectProgress?.(callback),
    onExtractProgress: (callback) => api.onExtractProgress?.(callback),
    onExportProgress: (callback) => api.onExportProgress?.(callback),
    onThemeChanged: (callback) => api.onThemeChanged?.(callback),
    onMenuAction: (callback) => api.onMenuAction?.(callback),
    onBeforeQuit: (callback) => api.onBeforeQuit?.(callback),
  };
})();
