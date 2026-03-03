// Store-Index — Re-Export aller Stores + zentrale Helfer
// visibleScenes-Berechnung und resetAllStores() leben hier

export * from './appState.svelte'
export * from './videoState.svelte'
export * from './selectionState.svelte'
export * from './detectionState.svelte'
export * from './uiState.svelte'
export * from './derivedState.svelte'

import { resetAppState } from './appState.svelte'
import { resetVideoState } from './videoState.svelte'
import { resetSelectionState } from './selectionState.svelte'
import { resetDetectionState } from './detectionState.svelte'
import { resetUiState } from './uiState.svelte'

/** Alle Stores auf Default-Werte zurücksetzen */
export function resetAllStores(): void {
  resetAppState()
  resetVideoState()
  resetSelectionState()
  resetDetectionState()
  resetUiState()
}
