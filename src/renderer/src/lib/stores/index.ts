// Store-Index — Re-Export aller Stores + zentrale Helfer
// visibleScenes-Berechnung und resetAllStores() leben hier

export * from './appState.svelte'
export * from './videoState.svelte'
export * from './selectionState.svelte'
export * from './detectionState.svelte'
export * from './uiState.svelte'
export * from './derivedState.svelte'
export * from './waveformState.svelte'
export * from './transcriptionState.svelte'

import { resetAppState } from './appState.svelte'
import { resetVideoState } from './videoState.svelte'
import { resetSelectionState } from './selectionState.svelte'
import { resetDetectionState } from './detectionState.svelte'
import { resetUiState } from './uiState.svelte'
import { resetWaveformState } from './waveformState.svelte'
import { resetTranscriptionState } from './transcriptionState.svelte'

/** Alle Stores auf Default-Werte zurücksetzen */
export function resetAllStores(): void {
  resetAppState()
  resetVideoState()
  resetSelectionState()
  resetDetectionState()
  resetUiState()
  resetWaveformState()
  resetTranscriptionState()
}
