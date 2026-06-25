// Request/Response-Types fuer alle IPC-Calls
// Definiert den Vertrag zwischen Main und Renderer

import type {
  VideoMeta,
  Scene,
  ThumbSize,
  ThumbResult,
  ProjectData,
  ExportCodecKey,
  ExportProgress,
  ProxyProgress,
  DetectionProgress,
  TranscriptionSegment,
  TranscriptionProgress,
  WhisperModel,
  AiProvider,
  AiAnalysisResult,
  ClipDefinition,
  ClipExportProgress,
  WaveformPeaks,
  ApiKeyProvider,
} from './models'

// Re-Export: Werden in preload/types.ts importiert
export type {
  ExportProgress,
  ProxyProgress,
  DetectionProgress,
  TranscriptionProgress,
  ClipExportProgress,
  ApiKeyProvider,
}

// --- Generisches Ergebnis ---

export interface IpcSuccess<T = void> {
  success: true
  data?: T
  [key: string]: unknown
}

export interface IpcError {
  success: false
  error: string
}

export type IpcResponse<T = void> = IpcSuccess<T> | IpcError

// ===== Video =====

export interface VideoOpenResponse {
  success: boolean
  path?: string
  meta?: {
    success: boolean
    data?: VideoMeta
    error?: string
  }
  error?: string
}

export interface VideoMetaResponse {
  success: boolean
  data?: VideoMeta
  error?: string
}

// ===== Scene Detection =====

export interface SceneDetectRequest {
  videoPath: string
  threshold: number
  /** V2: Optionale IN/OUT-Region */
  inPoint?: number
  outPoint?: number
}

export interface SceneDetectResponse {
  success: boolean
  scenes?: Scene[]
  error?: string
}

// ===== Frame-Extraktion =====

export interface FrameExtractRequest {
  videoPath: string
  scenes: Scene[]
  outputDir: string
  thumbSize?: ThumbSize
}

// ===== Projekt =====

export interface ProjectNewRequest {
  name: string
  videoPath: string
}

export interface ProjectNewResponse {
  success: boolean
  path?: string
  error?: string
}

export interface ProjectOpenResponse {
  success: boolean
  data?: ProjectData
  path?: string
  error?: string
}

export interface ProjectSaveRequest {
  projectPath: string
  data: ProjectData
}

// ===== Export =====

export interface ExportSequenceRequest {
  videoPath: string
  startTime: number
  endTime: number
  outputPath: string
  codec: ExportCodecKey
}

export interface ExportZipRequest {
  thumbnailPaths: string[]
  outputPath: string
}

export interface ExportSelectDirResponse {
  success: boolean
  path?: string
  error?: string
}

// ===== Theme =====

export type ThemeValue = 'dark' | 'light' | 'system'

export interface ThemeResponse {
  success: boolean
  theme?: ThemeValue
  error?: string
}

// ===== App =====

export interface AppVersionResponse {
  success: boolean
  version?: string
  ffmpeg?: {
    available: boolean
    path?: string
    version?: string
  }
  error?: string
}

// ===== Dialog =====

export interface DialogResponse {
  success: boolean
  path?: string
  response?: number
  error?: string
}

// ===== Proxy =====

export interface ProxyGenerateRequest {
  videoPath: string
  duration: number
}

export interface ProxyGenerateResponse {
  success: boolean
  proxyPath?: string
  error?: string
}

// ===== V2.0: Transcription =====

export interface TranscriptionStartRequest {
  videoPath: string
  model: WhisperModel
  language?: string
  /** V2: Optionale IN/OUT-Region */
  inPoint?: number
  outPoint?: number
}

export interface TranscriptionStartResponse {
  success: boolean
  segments?: TranscriptionSegment[]
  error?: string
}

// ===== V2.0: Audio-Extraktion =====

export interface AudioExtractRequest {
  videoPath: string
  outputPath?: string
  /** Ziel-Samplerate (Standard: 16000 fuer Whisper) */
  sampleRate?: number
}

export interface AudioExtractResponse {
  success: boolean
  audioPath?: string
  error?: string
}

// ===== V2.0: Waveform =====

export interface WaveformGenerateRequest {
  audioPath: string
  /** Anzahl Peaks (Standard: 1000) */
  numPeaks?: number
}

export interface WaveformGenerateResponse {
  success: boolean
  data?: WaveformPeaks
  error?: string
}

// ===== V2.0: AI Analyse =====

export interface AiAnalyzeRequest {
  segments: TranscriptionSegment[]
  instruction: string
  provider: AiProvider
  model?: string
}

export interface AiAnalyzeResponse {
  success: boolean
  data?: AiAnalysisResult
  error?: string
}

// ===== V2.0: Clip-Export =====
// ClipExportRequest ist in models.ts definiert — kein Duplikat hier

export interface ClipExportResponse {
  success: boolean
  exportedClips?: string[]
  error?: string
}

// ===== V2.0: API-Key-Verwaltung =====

export interface ApiKeySetRequest {
  provider: ApiKeyProvider
  key: string
}

export interface ApiKeyGetResponse {
  success: boolean
  key?: string
  error?: string
}

export interface ApiKeyHasResponse {
  success: boolean
  hasKey?: boolean
  error?: string
}

// ===== V2.0: ElevenLabs =====

export interface ElevenLabsTranscribeRequest {
  videoPath: string
  language?: string
  inPoint?: number
  outPoint?: number
}

// ===== Menue-Aktionen (Main -> Renderer) =====

export type MenuAction =
  | 'file:openVideo'
  | 'file:new'
  | 'file:open'
  | 'file:save'
  | 'file:saveAs'
  | 'edit:undo'
  | 'edit:redo'
  | 'edit:selectAll'
  | 'edit:deselect'
  | 'view:toggleTheme'
  | 'view:zoomIn'
  | 'view:zoomOut'
  | 'view:zoomReset'
  | 'export:sequence'
  | 'export:zip'

// ===== Progress-Callback-Types (Main -> Renderer) =====

export type DetectionProgressCallback = (progress: DetectionProgress) => void
export type ExportProgressCallback = (progress: ExportProgress) => void
export type ProxyProgressCallback = (progress: ProxyProgress) => void
export type TranscriptionProgressCallback = (progress: TranscriptionProgress) => void
export type ClipExportProgressCallback = (progress: ClipExportProgress) => void
