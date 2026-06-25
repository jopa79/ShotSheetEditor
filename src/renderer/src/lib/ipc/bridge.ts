// bridge.ts — Typisierter Wrapper um window.electronAPI
// Alle IPC-Methoden als typisierte async Funktionen
// Ersetzt V1 ipc.js (64 LOC)

import type { ElectronAPI } from '../../../../preload/types'
import type { Scene, ProjectData, ThumbResult } from '../../../../shared/models'
import type {
  VideoOpenResponse,
  VideoMetaResponse,
  SceneDetectResponse,
  ProjectNewResponse,
  ProjectOpenResponse,
  ExportSequenceRequest,
  ExportZipRequest,
  ExportSelectDirResponse,
  ThemeResponse,
  AppVersionResponse,
  DialogResponse,
  ProxyGenerateResponse,
} from '../../../../shared/ipcPayloads'

// --- Lazy-Access auf window.electronAPI ---

function api(): ElectronAPI {
  return window.electronAPI
}

// ===== Invoke: Renderer -> Main (mit Response) =====

// Video
export function openVideo(filePath: string): Promise<VideoOpenResponse> {
  return api().openVideo(filePath)
}

export function getVideoMeta(filePath: string): Promise<VideoMetaResponse> {
  return api().getVideoMeta(filePath)
}

// Scene Detection
export function detectScenes(
  videoPath: string,
  threshold: number
): Promise<SceneDetectResponse> {
  return api().detectScenes(videoPath, threshold)
}

export function cancelDetection(): Promise<{ success: boolean }> {
  return api().cancelDetection()
}

// Frame-Extraktion
export function extractFrames(
  videoPath: string,
  scenes: Scene[],
  outputDir: string
): Promise<{ success: boolean; error?: string }> {
  return api().extractFrames(videoPath, scenes, outputDir)
}

export function getThumb(thumbPath: string): Promise<ThumbResult> {
  return api().getThumb(thumbPath)
}

// Projekt
export function newProject(
  name: string,
  videoPath: string
): Promise<ProjectNewResponse> {
  return api().newProject(name, videoPath)
}

export function openProject(
  projectPath: string
): Promise<ProjectOpenResponse> {
  return api().openProject(projectPath)
}

export function saveProject(
  projectPath: string,
  data: ProjectData
): Promise<{ success: boolean; error?: string }> {
  return api().saveProject(projectPath, data)
}

// Export
export function exportSequence(
  data: ExportSequenceRequest
): Promise<{ success: boolean; error?: string }> {
  return api().exportSequence(data)
}

export function exportZip(
  data: ExportZipRequest
): Promise<{ success: boolean; error?: string }> {
  return api().exportZip(data)
}

// Clip-Export (Subclips)
export function exportClips(
  request: Parameters<ElectronAPI['exportClips']>[0]
): ReturnType<ElectronAPI['exportClips']> {
  return api().exportClips(request)
}

export function cancelClipExport(): Promise<{ success: boolean }> {
  return api().cancelClipExport()
}

// Audio-Extraktion (WAV) — Basis fuer Whisper + Waveform
export function extractAudio(
  request: Parameters<ElectronAPI['extractAudio']>[0]
): ReturnType<ElectronAPI['extractAudio']> {
  return api().extractAudio(request)
}

// Waveform-Peaks aus WAV
export function generateWaveform(
  request: Parameters<ElectronAPI['generateWaveform']>[0]
): ReturnType<ElectronAPI['generateWaveform']> {
  return api().generateWaveform(request)
}

// Whisper-Transkription (lokal)
export function startTranscription(
  request: Parameters<ElectronAPI['startTranscription']>[0]
): ReturnType<ElectronAPI['startTranscription']> {
  return api().startTranscription(request)
}

export function cancelTranscription(): Promise<{ success: boolean }> {
  return api().cancelTranscription()
}

export function onTranscriptionProgress(
  callback: Parameters<ElectronAPI['onTranscriptionProgress']>[0]
): CleanupFn {
  return api().onTranscriptionProgress(callback)
}

// API-Keys (safeStorage)
export function setApiKey(
  provider: Parameters<ElectronAPI['setApiKey']>[0],
  key: string
): ReturnType<ElectronAPI['setApiKey']> {
  return api().setApiKey(provider, key)
}

export function getApiKey(
  provider: Parameters<ElectronAPI['getApiKey']>[0]
): ReturnType<ElectronAPI['getApiKey']> {
  return api().getApiKey(provider)
}

export function hasApiKey(
  provider: Parameters<ElectronAPI['hasApiKey']>[0]
): ReturnType<ElectronAPI['hasApiKey']> {
  return api().hasApiKey(provider)
}

export function deleteApiKey(
  provider: Parameters<ElectronAPI['deleteApiKey']>[0]
): ReturnType<ElectronAPI['deleteApiKey']> {
  return api().deleteApiKey(provider)
}

export function selectExportDir(): Promise<ExportSelectDirResponse> {
  return api().selectExportDir()
}

// Theme
export function toggleTheme(): Promise<ThemeResponse> {
  return api().toggleTheme()
}

export function getTheme(): Promise<ThemeResponse> {
  return api().getTheme()
}

// App
export function getVersion(): Promise<AppVersionResponse> {
  return api().getVersion()
}

export function confirmQuit(): Promise<void> {
  return api().confirmQuit()
}

// Proxy
export function generateProxy(
  videoPath: string,
  duration: number
): Promise<ProxyGenerateResponse> {
  return api().generateProxy(videoPath, duration)
}

export function cancelProxy(): Promise<{ success: boolean }> {
  return api().cancelProxy()
}

// Dialoge
export function openVideoDialog(): Promise<DialogResponse> {
  return api().openVideoDialog()
}

export function openProjectDialog(): Promise<DialogResponse> {
  return api().openProjectDialog()
}

export function saveProjectDialog(): Promise<DialogResponse> {
  return api().saveProjectDialog()
}

export function unsavedChangesDialog(): Promise<DialogResponse> {
  return api().unsavedChangesDialog()
}

// ===== Listener: Main -> Renderer =====
// Jeder gibt eine Cleanup-Funktion zurück

export type CleanupFn = () => void

export function onDetectProgress(
  callback: Parameters<ElectronAPI['onDetectProgress']>[0]
): CleanupFn {
  return api().onDetectProgress(callback)
}

export function onExtractProgress(
  callback: Parameters<ElectronAPI['onExtractProgress']>[0]
): CleanupFn {
  return api().onExtractProgress(callback)
}

export function onProxyProgress(
  callback: Parameters<ElectronAPI['onProxyProgress']>[0]
): CleanupFn {
  return api().onProxyProgress(callback)
}

export function onExportProgress(
  callback: Parameters<ElectronAPI['onExportProgress']>[0]
): CleanupFn {
  return api().onExportProgress(callback)
}

export function onClipExportProgress(
  callback: Parameters<ElectronAPI['onClipExportProgress']>[0]
): CleanupFn {
  return api().onClipExportProgress(callback)
}

export function onThemeChanged(callback: (theme: string) => void): CleanupFn {
  return api().onThemeChanged(callback)
}

export function onMenuAction(
  callback: Parameters<ElectronAPI['onMenuAction']>[0]
): CleanupFn {
  return api().onMenuAction(callback)
}

export function onBeforeQuit(callback: () => void): CleanupFn {
  return api().onBeforeQuit(callback)
}
