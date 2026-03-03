// selectionState.svelte.ts — Selektions-State
// Enthält: selectedIndices, favoriteIndices, deletedIndices

// --- Reaktive State-Werte ---

let _selectedIndices = $state<number[]>([])
let _favoriteIndices = $state<number[]>([])
let _deletedIndices = $state<number[]>([])

// --- Getter ---

export function getSelectedIndices(): number[] {
  return _selectedIndices
}

export function getFavoriteIndices(): number[] {
  return _favoriteIndices
}

export function getDeletedIndices(): number[] {
  return _deletedIndices
}

// --- Setter ---

export function setSelectedIndices(indices: number[]): void {
  _selectedIndices = indices
}

export function setFavoriteIndices(indices: number[]): void {
  _favoriteIndices = indices
}

export function setDeletedIndices(indices: number[]): void {
  _deletedIndices = indices
}

// --- Reset ---

export function resetSelectionState(): void {
  _selectedIndices = []
  _favoriteIndices = []
  _deletedIndices = []
}
