// derivedState.svelte.ts — Berechnete/abgeleitete State-Werte
// Ersetzt AppState.getVisibleScenes() aus V1

import type { Scene } from '../../../../shared/models'
import { getScenes, getCollections } from './appState.svelte'
import { getDeletedIndices, getFavoriteIndices } from './selectionState.svelte'
import {
  getFilterMode,
  getActiveCollectionId,
  getCurrentShotIdx,
} from './uiState.svelte'
import { getVideoPath, getVideoMeta } from './videoState.svelte'

// --- Sichtbare Szene mit Originalindex ---

export interface VisibleScene extends Scene {
  originalIdx: number
}

/**
 * Berechnet die sichtbaren Szenen basierend auf Filter, Deleted und Collection.
 * Ersetzt V1 AppState.getVisibleScenes()
 */
export function getVisibleScenes(): VisibleScene[] {
  const scenes = getScenes()
  const filterMode = getFilterMode()
  const activeCollectionId = getActiveCollectionId()
  const deletedIndices = getDeletedIndices()
  const favoriteIndices = getFavoriteIndices()
  const collections = getCollections()

  const deletedSet = new Set(deletedIndices)
  const favoriteSet = filterMode === 'favorites' ? new Set(favoriteIndices) : null

  let collectionSet: Set<number> | null = null
  if (filterMode === 'collection' && activeCollectionId) {
    const col = collections.find((c) => c.id === activeCollectionId)
    collectionSet = col ? new Set(col.indices) : null
  }

  const visible: VisibleScene[] = []

  scenes.forEach((scene, idx) => {
    if (deletedSet.has(idx)) return
    if (favoriteSet && !favoriteSet.has(idx)) return
    if (collectionSet && !collectionSet.has(idx)) return

    visible.push({
      ...scene,
      originalIdx: idx,
    })
  })

  return visible
}

/** Aktuelle Szene anhand von currentShotIdx */
export function getCurrentScene(): Scene | null {
  const idx = getCurrentShotIdx()
  const scenes = getScenes()
  if (idx < 0 || idx >= scenes.length) return null
  return scenes[idx]
}

/** true wenn Video geladen (Pfad + Metadaten vorhanden) */
export function hasVideo(): boolean {
  return getVideoPath() !== null && getVideoMeta() !== null
}
