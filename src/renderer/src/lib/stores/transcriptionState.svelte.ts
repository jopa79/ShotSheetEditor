// transcriptionState.svelte.ts — Whisper-Transkriptionssegmente + Status
// Enthält: segments, isTranscribing, progress

import type { TranscriptionSegment } from '../../../../shared/models'

let _segments = $state<TranscriptionSegment[]>([])
let _isTranscribing = $state(false)
let _progress = $state(0)

// --- Getter ---

export function getTranscriptionSegments(): TranscriptionSegment[] {
  return _segments
}

export function getIsTranscribing(): boolean {
  return _isTranscribing
}

export function getTranscriptionProgress(): number {
  return _progress
}

// --- Setter ---

export function setTranscriptionSegments(segments: TranscriptionSegment[]): void {
  _segments = segments
}

export function setIsTranscribing(value: boolean): void {
  _isTranscribing = value
}

export function setTranscriptionProgress(percent: number): void {
  _progress = percent
}

// --- Reset ---

export function resetTranscriptionState(): void {
  _segments = []
  _isTranscribing = false
  _progress = 0
}
