// collectionActions.ts — Collection-CRUD-Aktionen
// Ersetzt V1 collectionManager.js (Business-Logik)

import type { Collection } from '../../../../shared/models'
import {
  getCollections,
  setCollections,
  getActiveCollectionId,
  setActiveCollectionId,
  setFilterMode,
} from '../stores'
import { withUndo } from './undoRedo'

/** Eindeutige Collection-ID generieren */
function generateId(): string {
  return 'col_' + Math.random().toString(36).substring(2, 8)
}

/**
 * Neue Collection erstellen.
 * Fix #141: name wird validiert
 * Fix #142: indices wird auf Array geprüft
 * Fix #123: commit() VOR setState() — via withUndo() atomisch gesichert
 */
export function createCollection(name: string, indices: number[] = []): Collection {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Collection name must be a non-empty string')
  }

  const safeIndices = Array.isArray(indices) ? indices : []
  const uniqueIndices = [...new Set(safeIndices)].sort((a, b) => a - b)

  const collection: Collection = {
    id: generateId(),
    name: name.trim(),
    indices: uniqueIndices,
  }

  withUndo(() => {
    setCollections([...getCollections(), collection])
  })
  return collection
}

/**
 * Collection löschen.
 * Fix #123: commit() VOR setState() — via withUndo() atomisch gesichert.
 * Hinweis: setActiveCollectionId/setFilterMode sind UI-State (kein Snapshot-Bestandteil)
 * und laufen daher nach dem withUndo-Block — das ist korrekt.
 */
export function deleteCollection(id: string): void {
  withUndo(() => {
    setCollections(getCollections().filter((c) => c.id !== id))
  })

  // Aktive Collection zurücksetzen wenn die gelöschte aktiv war
  // (UI-State — nicht Teil des Undo-Snapshots)
  if (getActiveCollectionId() === id) {
    setActiveCollectionId(null)
    setFilterMode('all')
  }
}

/**
 * Collection umbenennen.
 * Fix #141: name wird validiert
 * Fix #123: commit() VOR setState() — via withUndo() atomisch gesichert
 */
export function renameCollection(id: string, name: string): void {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Collection name must be a non-empty string')
  }

  withUndo(() => {
    setCollections(
      getCollections().map((c) => (c.id === id ? { ...c, name: name.trim() } : c))
    )
  })
}

/**
 * Szenen zu einer Collection hinzufügen (Set-basiert, keine Duplikate).
 * Fix #142: indices wird auf Array geprüft
 * Fix #123: commit() VOR setState() — via withUndo() atomisch gesichert
 */
export function addToCollection(id: string, indices: number[]): void {
  const safeIndices = Array.isArray(indices) ? indices : []

  withUndo(() => {
    setCollections(
      getCollections().map((c) => {
        if (c.id !== id) return c
        const indexSet = new Set(c.indices)
        for (const idx of safeIndices) {
          indexSet.add(idx)
        }
        return { ...c, indices: [...indexSet].sort((a, b) => a - b) }
      })
    )
  })
}

/**
 * Szenen aus einer Collection entfernen.
 * Fix #123: commit() VOR setState() — via withUndo() atomisch gesichert
 */
export function removeFromCollection(id: string, indices: number[]): void {
  const removeSet = new Set(Array.isArray(indices) ? indices : [])

  withUndo(() => {
    setCollections(
      getCollections().map((c) => {
        if (c.id !== id) return c
        return { ...c, indices: c.indices.filter((i) => !removeSet.has(i)) }
      })
    )
  })
}

/** Collection als aktiven Filter setzen */
export function setActiveCollection(id: string): void {
  setFilterMode('collection')
  setActiveCollectionId(id)
}

/** Collection-Filter aufheben → zurück zu "all" */
export function clearActiveCollection(): void {
  setFilterMode('all')
  setActiveCollectionId(null)
}

/** Collection per ID holen */
export function getCollection(id: string): Collection | null {
  return getCollections().find((c) => c.id === id) ?? null
}
