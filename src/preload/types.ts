// ElectronAPI Interface — definiert den Vertrag zwischen Preload und Renderer
// Wird im Preload implementiert und im Renderer via window.electronAPI genutzt

import type {
  VideoOpenResponse,
  VideoMetaResponse,
  SceneDetectResponse,
  FrameExtractRequest,
  ProjectNewResponse,
  ProjectOpenResponse,
  ProjectSaveRequest,
  ExportSequenceRequest,
  ExportZipRequest,
  ExportSelectDirResponse,
  ThemeResponse,
  AppVersionResponse,
  DialogResponse,
  ProxyGenerateResponse,
  MenuAction,
  DetectionProgress,
  ExportProgress,
  ProxyProgress,
  TranscriptionStartRequest,
  TranscriptionStartResponse,
  TranscriptionProgress,
  AiAnalyzeRequest,
  AiAnalyzeResponse,
  ClipExportResponse,
  ClipExportProgress,
  AudioExtractRequest,
  AudioExtractResponse,
  WaveformGenerateRequest,
  WaveformGenerateResponse,
  ApiKeyProvider,
  ApiKeyGetResponse,
  ApiKeyHasResponse,
  ElevenLabsTranscribeRequest,
} from '../shared/ipcPayloads'
import type { Scene, ProjectData, ThumbResult, ClipExportRequest } from '../shared/models'

/** Cleanup-Funktion die IPC-Listener entfernt */
export type CleanupFn = () => void

export interface ElectronAPI {
  // ===== Invoke: Renderer -> Main (mit Response) =====

  // Video
  openVideo: (filePath: string) => Promise<VideoOpenResponse>
  getVideoMeta: (filePath: string) => Promise<VideoMetaResponse>

  // Scene Detection
  detectScenes: (videoPath: string, threshold: number) => Promise<SceneDetectResponse>
  cancelDetection: () => Promise<{ success: boolean }>

  // Frame-Extraktion
  extractFrames: (
    videoPath: string,
    scenes: Scene[],
    outputDir: string
  ) => Promise<{ success: boolean; error?: string }>
  getThumb: (thumbPath: string) => Promise<ThumbResult>

  // Projekt
  newProject: (name: string, videoPath: string) => Promise<ProjectNewResponse>
  openProject: (projectPath: string) => Promise<ProjectOpenResponse>
  saveProject: (projectPath: string, data: ProjectData) => Promise<{ success: boolean; error?: string }>

  // Export
  exportSequence: (data: ExportSequenceRequest) => Promise<{ success: boolean; error?: string }>
  exportZip: (data: ExportZipRequest) => Promise<{ success: boolean; error?: string }>
  selectExportDir: () => Promise<ExportSelectDirResponse>

  // Theme
  toggleTheme: () => Promise<ThemeResponse>
  getTheme: () => Promise<ThemeResponse>

  // App
  getVersion: () => Promise<AppVersionResponse>
  confirmQuit: () => Promise<void>

  // Proxy
  generateProxy: (videoPath: string, duration: number) => Promise<ProxyGenerateResponse>
  cancelProxy: () => Promise<{ success: boolean }>

  // Dialoge
  openVideoDialog: () => Promise<DialogResponse>
  openProjectDialog: () => Promise<DialogResponse>
  saveProjectDialog: () => Promise<DialogResponse>
  unsavedChangesDialog: () => Promise<DialogResponse>

  // ===== Listener: Main -> Renderer (fire & forget) =====
  // Jeder gibt eine Cleanup-Funktion zurueck

  onDetectProgress: (callback: (progress: DetectionProgress) => void) => CleanupFn
  onExtractProgress: (callback: (progress: { percent: number }) => void) => CleanupFn
  onProxyProgress: (callback: (progress: ProxyProgress) => void) => CleanupFn
  onExportProgress: (callback: (progress: ExportProgress) => void) => CleanupFn
  onThemeChanged: (callback: (theme: string) => void) => CleanupFn
  onMenuAction: (callback: (action: MenuAction) => void) => CleanupFn
  onBeforeQuit: (callback: () => void) => CleanupFn

  // --- V2.0 Neue Methods (werden in spaeterer Phase implementiert) ---
  // Hier schon als Interface definiert fuer Forward-Compatibility

  // Transcription
  startTranscription?: (request: TranscriptionStartRequest) => Promise<TranscriptionStartResponse>
  cancelTranscription?: () => Promise<{ success: boolean }>
  onTranscriptionProgress?: (callback: (progress: TranscriptionProgress) => void) => CleanupFn

  // Audio (implementiert — nicht optional)
  extractAudio: (request: AudioExtractRequest) => Promise<AudioExtractResponse>

  // Waveform (implementiert — nicht optional)
  generateWaveform: (request: WaveformGenerateRequest) => Promise<WaveformGenerateResponse>

  // AI Analyse
  analyzeSegments?: (request: AiAnalyzeRequest) => Promise<AiAnalyzeResponse>

  // Clip-Export (implementiert — nicht optional)
  exportClips: (request: ClipExportRequest) => Promise<ClipExportResponse>
  cancelClipExport: () => Promise<{ success: boolean }>
  onClipExportProgress: (callback: (progress: ClipExportProgress) => void) => CleanupFn

  // API-Keys
  setApiKey?: (provider: ApiKeyProvider, key: string) => Promise<{ success: boolean }>
  getApiKey?: (provider: ApiKeyProvider) => Promise<ApiKeyGetResponse>
  hasApiKey?: (provider: ApiKeyProvider) => Promise<ApiKeyHasResponse>
  deleteApiKey?: (provider: ApiKeyProvider) => Promise<{ success: boolean }>

  // ElevenLabs
  transcribeElevenLabs?: (request: ElevenLabsTranscribeRequest) => Promise<TranscriptionStartResponse>
}
