// videoState.svelte.ts — Video-State
// Enthält: videoPath, videoMeta, isTranscoding, transcodeProgress

import type { VideoMeta } from '../../../../shared/models'

// --- Reaktive State-Werte ---

let _videoPath = $state<string | null>(null)
let _videoMeta = $state<{ success: boolean; data?: VideoMeta; error?: string } | null>(null)
let _isTranscoding = $state(false)
let _transcodeProgress = $state(0)

// --- Derived ---

/** true wenn Video geladen (Pfad + Metadaten vorhanden) */
export function getHasVideo(): boolean {
  return _videoPath !== null && _videoMeta !== null
}

// --- Getter ---

export function getVideoPath(): string | null {
  return _videoPath
}

export function getVideoMeta(): { success: boolean; data?: VideoMeta; error?: string } | null {
  return _videoMeta
}

export function getIsTranscoding(): boolean {
  return _isTranscoding
}

export function getTranscodeProgress(): number {
  return _transcodeProgress
}

// --- Setter ---

export function setVideoPath(path: string | null): void {
  _videoPath = path
}

export function setVideoMeta(
  meta: { success: boolean; data?: VideoMeta; error?: string } | null
): void {
  _videoMeta = meta
}

export function setIsTranscoding(transcoding: boolean): void {
  _isTranscoding = transcoding
}

export function setTranscodeProgress(progress: number): void {
  _transcodeProgress = progress
}

// --- Reset ---

export function resetVideoState(): void {
  _videoPath = null
  _videoMeta = null
  _isTranscoding = false
  _transcodeProgress = 0
}
