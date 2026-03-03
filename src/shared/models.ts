// Datenmodelle — geteilt zwischen Main und Renderer

// --- Video ---

export interface VideoMeta {
  codec: string
  width: number
  height: number
  duration: number
  fps: number
  size: number
  format: string
  needsProxy?: boolean
}

// --- Scene Detection ---

export interface Scene {
  index: number
  startTime: number
  endTime: number
  duration: number
  thumbPath?: string
}

export interface DetectionProgress {
  progress: number
  processedTime: number
  totalDuration: number
  scenesDetected: number
  /** Progressiv erkannte Szenen (V2: Realtime-Anzeige) */
  newScenes: DetectedSceneInfo[]
}

export interface DetectedSceneInfo {
  index: number
  startTime: number
  tc?: string
}

// --- Collections ---

export interface Collection {
  id: string
  name: string
  indices: number[]
}

// --- Thumbnails ---

export interface ThumbSize {
  width: number
  height: number
}

export interface ThumbResult {
  success: boolean
  data?: string // base64 data-URL
  error?: string
}

// --- Projekt ---

export interface ProjectData {
  videoPath: string
  scenes: Scene[]
  collections: Collection[]
  favoriteIndices: number[]
  deletedIndices: number[]
  threshold: number
  gridSize: number
  /** V2: Transkriptions-Segmente (optional, nur wenn transkribiert) */
  transcriptionSegments?: TranscriptionSegment[]
}

// --- Export ---

export type ExportCodecKey = 'PRORES' | 'H264'

export interface ExportCodecPreset {
  name: string
  extension: string
  args: string[]
}

export interface ExportProgress {
  percent: number
  currentFile?: string
}

// --- Proxy ---

export interface ProxyProgress {
  progress: number
}

// --- V2.0: Transcription ---

export interface TranscriptionSegment {
  id: string
  startTime: number
  endTime: number
  text: string
  speaker?: string
  confidence?: number
  /** Erster Frame als Thumbnail-Pfad */
  thumbStartPath?: string
  /** Letzter Frame als Thumbnail-Pfad */
  thumbEndPath?: string
  /** AI-Analyse-Ergebnis (optional, nach AI-Filter) */
  aiResult?: AiSegmentResult
}

export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium'

export interface TranscriptionProgress {
  percent: number
  currentSegment?: number
  totalSegments?: number
  /** Progressiv erkannte Segmente */
  segments?: TranscriptionSegment[]
}

// --- V2.0: AI Text-Analyse ---

export interface AiSegmentResult {
  segmentId: string
  category: string
  relevance: number // 0.0 - 1.0
  reason: string
}

export interface AiAnalysisResult {
  matches: AiSegmentResult[]
  provider: AiProvider
  model: string
}

export type AiProvider = 'openai' | 'anthropic'

export type TranscriptionProvider = 'whisper' | 'elevenlabs'

// --- V2.0: Timeline ---

export interface TimelineMarkers {
  inPoint: number | null // Sekunden
  outPoint: number | null // Sekunden
}

export interface WaveformPeaks {
  peaks: number[] // Normalisierte Amplitude-Werte (0.0 - 1.0)
  sampleRate: number
  duration: number
}

// --- V2.0: Clip-Export ---

export interface ClipExportRequest {
  videoPath: string
  clips: ClipDefinition[]
  outputDir: string
  codec: ExportCodecKey
}

export interface ClipDefinition {
  startTime: number
  endTime: number
  name: string
}

export interface ClipExportProgress {
  percent: number
  currentClip: number
  totalClips: number
  currentName?: string
}

// --- V2.0: API-Keys ---

export type ApiKeyProvider = 'openai' | 'anthropic' | 'elevenlabs'

// --- Generische IPC-Response ---

export interface IpcResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}
