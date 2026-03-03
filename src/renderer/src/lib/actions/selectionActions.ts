// selectionActions.ts — Selektions- und Favoriten-Aktionen
// Ersetzt V1 selectionManager.js (Business-Logik)

import {
  getSelectedIndices,
  setSelectedIndices,
  getFavoriteIndices,
  setFavoriteIndices,
  getDeletedIndices,
  setDeletedIndices,
  getScenes,
} from '../stores'
import { getVisibleScenes } from '../stores'
import * as undoRedo from './undoRedo'

/** Einzelnen Shot selektieren/deselektieren (Toggle) */
export function selectShot(idx: number): void {
  const selected = [...getSelectedIndices()]
  const pos = selected.indexOf(idx)
  if (pos !== -1) {
    selected.splice(pos, 1)
  } else {
    selected.push(idx)
  }
  setSelectedIndices(selected)
}

/**
 * Shots im Bereich selektieren (inklusiv).
 * Bounds-Check gegen scenes.length und deletedIndices (Fix #148)
 */
export function selectRange(fromIdx: number, toIdx: number): void {
  if (fromIdx < 0 || toIdx < 0) {
    selectShot(toIdx >= 0 ? toIdx : fromIdx)
    return
  }

  const start = Math.min(fromIdx, toIdx)
  const end = Math.max(fromIdx, toIdx)
  const scenesLength = getScenes().length
  const deletedSet = new Set(getDeletedIndices())
  const newSelected: number[] = []

  for (let i = start; i <= end; i++) {
    if (i < scenesLength && !deletedSet.has(i)) {
      newSelected.push(i)
    }
  }

  setSelectedIndices(newSelected)
}

/** Alle sichtbaren Shots selektieren */
export function selectAll(): void {
  const scenes = getVisibleScenes()
  setSelectedIndices(scenes.map((s) => s.originalIdx))
}

/** Alle Shots deselektieren */
export function deselectAll(): void {
  setSelectedIndices([])
}

/** Selektion invertieren (sichtbare Shots) */
export function invertSelection(): void {
  const scenes = getVisibleScenes()
  const selectedSet = new Set(getSelectedIndices())
  const newSelected = scenes
    .filter((s) => !selectedSet.has(s.originalIdx))
    .map((s) => s.originalIdx)
  setSelectedIndices(newSelected)
}

/**
 * Favorit-Status toggeln.
 * Fix #87: commit() VOR setState()
 */
export function toggleFavorite(idx: number): void {
  const favorites = [...getFavoriteIndices()]
  const pos = favorites.indexOf(idx)
  if (pos !== -1) {
    favorites.splice(pos, 1)
  } else {
    favorites.push(idx)
  }

  undoRedo.commit()
  setFavoriteIndices(favorites)
}

/**
 * Alle selektierten Shots zu Favoriten hinzufügen.
 * Fix #87: commit() VOR setState()
 */
export function favSelected(): void {
  const selected = getSelectedIndices()
  const favoriteSet = new Set(getFavoriteIndices())
  for (const idx of selected) {
    favoriteSet.add(idx)
  }
  const newFavorites = Array.from(favoriteSet).sort((a, b) => a - b)

  undoRedo.commit()
  setFavoriteIndices(newFavorites)
}

/**
 * Alle selektierten Shots von Favoriten entfernen.
 * Fix #87: commit() VOR setState()
 */
export function unfavSelected(): void {
  const selectedSet = new Set(getSelectedIndices())
  const newFavorites = getFavoriteIndices().filter((idx) => !selectedSet.has(idx))

  undoRedo.commit()
  setFavoriteIndices(newFavorites)
}

/**
 * Selektierte Shots löschen (soft delete).
 * Fix #87: commit() VOR setState()
 */
export function deleteSelected(): void {
  const selected = getSelectedIndices()
  if (selected.length === 0) return

  const deletedSet = new Set(getDeletedIndices())
  for (const idx of selected) {
    deletedSet.add(idx)
  }
  const newDeleted = Array.from(deletedSet).sort((a, b) => a - b)

  undoRedo.commit()
  setDeletedIndices(newDeleted)
  setSelectedIndices([])
}

/**
 * Einzelnen Shot löschen (unabhängig von Selektion).
 * Fix #87: commit() VOR setState()
 */
export function deleteSingle(idx: number): void {
  const deleted = getDeletedIndices()
  if (deleted.includes(idx)) return

  undoRedo.commit()
  setDeletedIndices([...deleted, idx].sort((a, b) => a - b))
}

/**
 * Einzelnen Shot wiederherstellen.
 * Fix #87: commit() VOR setState()
 */
export function restoreSingle(idx: number): void {
  undoRedo.commit()
  setDeletedIndices(getDeletedIndices().filter((i) => i !== idx))
}
