// waveformState.svelte.ts — Waveform-Peaks fuer die aktuelle Tonspur
// Enthält: peaks (0..1), duration, isGenerating

import type { WaveformPeaks } from '../../../../shared/models'

let _peaks = $state<number[]>([])
let _duration = $state(0)
let _isGenerating = $state(false)

// --- Getter ---

export function getWaveformPeaks(): number[] {
  return _peaks
}

export function getWaveformDuration(): number {
  return _duration
}

export function getIsGeneratingWaveform(): boolean {
  return _isGenerating
}

// --- Setter ---

export function setWaveform(data: WaveformPeaks | null): void {
  _peaks = data?.peaks ?? []
  _duration = data?.duration ?? 0
}

export function setIsGeneratingWaveform(generating: boolean): void {
  _isGenerating = generating
}

// --- Reset ---

export function resetWaveformState(): void {
  _peaks = []
  _duration = 0
  _isGenerating = false
}
