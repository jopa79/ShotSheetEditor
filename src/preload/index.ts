import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { ElectronAPI, CleanupFn } from './types'

// Typisierter Helper fuer IPC-Listener (Main -> Renderer)
// Gibt immer eine Cleanup-Funktion zurueck
function createListener<T>(channel: string, callback: (data: T) => void): CleanupFn {
  const handler = (_event: IpcRendererEvent, data: T) => callback(data)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: ElectronAPI = {
  // ===== Invoke: Renderer -> Main =====

  // Video
  openVideo: (filePath) => ipcRenderer.invoke('video:open', filePath),
  getVideoMeta: (filePath) => ipcRenderer.invoke('video:getMeta', filePath),

  // Scene Detection
  detectScenes: (videoPath, threshold) =>
    ipcRenderer.invoke('scene:detect', { videoPath, threshold }),
  cancelDetection: () => ipcRenderer.invoke('scene:detectCancel'),

  // Frame-Extraktion
  extractFrames: (videoPath, scenes, outputDir) =>
    ipcRenderer.invoke('frame:extractBatch', { videoPath, scenes, outputDir }),
  getThumb: (thumbPath) => ipcRenderer.invoke('frame:getThumb', thumbPath),

  // Projekt
  newProject: (name, videoPath) =>
    ipcRenderer.invoke('project:new', { name, videoPath }),
  openProject: (projectPath) => ipcRenderer.invoke('project:open', projectPath),
  saveProject: (projectPath, data) =>
    ipcRenderer.invoke('project:save', { projectPath, data }),

  // Export
  exportSequence: (data) => ipcRenderer.invoke('export:sequence', data),
  exportZip: (data) => ipcRenderer.invoke('export:zip', data),
  selectExportDir: () => ipcRenderer.invoke('export:selectDir'),

  // Clip-Export (Subclips)
  exportClips: (request) => ipcRenderer.invoke('clip:export', request),
  cancelClipExport: () => ipcRenderer.invoke('clip:exportCancel'),
  onClipExportProgress: (callback) => createListener('clip:exportProgress', callback),

  // Audio-Extraktion (WAV)
  extractAudio: (request) => ipcRenderer.invoke('audio:extract', request),

  // Waveform-Peaks
  generateWaveform: (request) => ipcRenderer.invoke('waveform:generate', request),

  // Whisper-Transkription
  startTranscription: (request) => ipcRenderer.invoke('transcription:start', request),
  cancelTranscription: () => ipcRenderer.invoke('transcription:cancel'),
  onTranscriptionProgress: (callback) => createListener('transcription:progress', callback),

  // Theme
  toggleTheme: () => ipcRenderer.invoke('theme:toggle'),
  getTheme: () => ipcRenderer.invoke('theme:get'),

  // App
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  confirmQuit: () => ipcRenderer.invoke('app:confirmQuit'),

  // Proxy
  generateProxy: (videoPath, duration) =>
    ipcRenderer.invoke('proxy:generate', { videoPath, duration }),
  cancelProxy: () => ipcRenderer.invoke('proxy:cancel'),

  // Dialoge
  openVideoDialog: () => ipcRenderer.invoke('dialog:openVideo'),
  openProjectDialog: () => ipcRenderer.invoke('dialog:openProject'),
  saveProjectDialog: () => ipcRenderer.invoke('dialog:saveProject'),
  unsavedChangesDialog: () => ipcRenderer.invoke('dialog:unsavedChanges'),

  // ===== Listener: Main -> Renderer =====

  onDetectProgress: (callback) => createListener('scene:detectProgress', callback),
  onExtractProgress: (callback) => createListener('frame:extractProgress', callback),
  onProxyProgress: (callback) => createListener('proxy:generateProgress', callback),
  onExportProgress: (callback) => createListener('export:sequenceProgress', callback),
  onThemeChanged: (callback) => createListener('theme:changed', callback),
  onMenuAction: (callback) => createListener('menu:action', callback),

  onBeforeQuit: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('app:beforeQuit', handler)
    return () => ipcRenderer.removeListener('app:beforeQuit', handler)
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
