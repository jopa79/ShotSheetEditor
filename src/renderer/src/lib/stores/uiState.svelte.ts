// uiState.svelte.ts — UI-State
// Enthält: gridSize, filterMode, activeCollectionId, currentShotIdx, autoSaveEnabled

// --- Types ---

export type FilterMode = 'all' | 'favorites' | 'collection'

// --- Reaktive State-Werte ---

let _gridSize = $state(200)
let _filterMode = $state<FilterMode>('all')
let _activeCollectionId = $state<string | null>(null)
let _currentShotIdx = $state(-1)
// Auto-Save-Praeferenz — projekt-scoped (in project.json persistiert, beim Laden
// gesetzt, bei File→New auf Default true zurueck). Reaktiv fuer die Statusbar-UI.
let _autoSaveEnabled = $state(true)

// --- Getter ---

export function getGridSize(): number {
  return _gridSize
}

export function getFilterMode(): FilterMode {
  return _filterMode
}

export function getActiveCollectionId(): string | null {
  return _activeCollectionId
}

export function getCurrentShotIdx(): number {
  return _currentShotIdx
}

export function getAutoSaveEnabled(): boolean {
  return _autoSaveEnabled
}

// --- Setter ---

export function setGridSize(size: number): void {
  _gridSize = size
}

export function setFilterMode(mode: FilterMode): void {
  _filterMode = mode
}

export function setActiveCollectionId(id: string | null): void {
  _activeCollectionId = id
}

export function setCurrentShotIdx(idx: number): void {
  _currentShotIdx = idx
}

export function setAutoSaveEnabled(enabled: boolean): void {
  _autoSaveEnabled = enabled
}

// --- Reset ---

export function resetUiState(): void {
  _gridSize = 200
  _filterMode = 'all'
  _activeCollectionId = null
  _currentShotIdx = -1
  _autoSaveEnabled = true
}
