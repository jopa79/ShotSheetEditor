// Konfigurationskonstanten — TypeScript-Version
// WICHTIG: Muessen mit constants.js uebereinstimmen (bis Main migriert ist)

import type { ExportCodecPreset, ExportCodecKey, ThumbSize } from './models'

// Re-export IPC Channels aus dedizierter Datei
export { IPC_CHANNELS } from './ipcChannels'
export type { IpcChannel } from './ipcChannels'

// --- Window ---

export const WINDOW_DEFAULTS = {
  width: 1280,
  height: 800,
  minWidth: 900,
  minHeight: 600,
} as const

// --- Scene Detection ---

export const DETECTION_DEFAULTS = {
  threshold: 0.3,
  minThreshold: 0.05,
  maxThreshold: 0.9,
} as const

// --- Thumbnails ---

export const THUMB_SIZE: ThumbSize = {
  width: 320,
  height: 180,
}

// --- Unterstuetzte Video-Formate ---

export const SUPPORTED_FORMATS = [
  '.mp4',
  '.mov',
  '.mkv',
  '.avi',
  '.mxf',
  '.webm',
] as const

export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number]

// --- Export Codec Presets ---

export const EXPORT_CODECS: Record<ExportCodecKey, ExportCodecPreset> = {
  PRORES: {
    name: 'ProRes 422 HQ',
    extension: '.mov',
    args: ['-c:v', 'prores_ks', '-profile:v', '3', '-c:a', 'pcm_s16le', '-f', 'mov'],
  },
  H264: {
    name: 'H.264 (MP4)',
    extension: '.mp4',
    args: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'aac', '-f', 'mp4'],
  },
}

// --- Proxy-Transkodierung ---

export const PROXY_CONFIG = {
  BROWSER_COMPATIBLE_CODECS: ['h264', 'vp8', 'vp9', 'av1'],
  BROWSER_COMPATIBLE_CONTAINERS: ['.mp4', '.webm'],
  VIDEO_FILTER: 'scale=-2:720',
  PIX_FMT: 'yuv420p', // Chromium unterstuetzt nur yuv420p
  PRESET: 'ultrafast',
  CRF: '28',
  TEMP_DIR_NAME: 'shotsheet-proxies',
} as const

// --- Timer ---

/** Auto-Save Intervall: 5 Minuten */
export const AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000

/** Quit-Timeout Safety: 5 Sekunden */
export const QUIT_TIMEOUT_MS = 5000

// --- V2.0: Whisper ---

export const WHISPER_DEFAULTS = {
  model: 'base' as const,
  sampleRate: 16000,
  language: 'auto',
} as const

// --- V2.0: Waveform ---

export const WAVEFORM_DEFAULTS = {
  numPeaks: 1000,
} as const

// --- Utility ---

/** Sekunden zu Timecode HH:MM:SS.mmm (fuer FFmpeg / Main-Process) */
export function secondsToTimecode(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs.toFixed(3)).padStart(6, '0')}`
}
