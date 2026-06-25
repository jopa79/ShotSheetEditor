// undoRedo.ts — Undo/Redo Stack mit Store-Integration
// Ersetzt V1 undoRedo.js (133 LOC)
// Max 50 Snapshots, JSON-basierte Deep-Clone-Strategie

import type { Scene, Collection } from '../../../../shared/models'
import {
  getScenes,
  setScenes,
  getCollections,
  setCollections,
  getFavoriteIndices,
  setFavoriteIndices,
  getDeletedIndices,
  setDeletedIndices,
  setIsDirty,
} from '../stores'

const MAX_STACK_SIZE = 50

// --- Snapshot-Typ ---

interface Snapshot {
  scenes: Scene[]
  favoriteIndices: number[]
  deletedIndices: number[]
  collections: Collection[]
}

// --- Stacks ---

let undoStack: Snapshot[] = []
let redoStack: Snapshot[] = []

// --- Helpers ---

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

function createSnapshot(): Snapshot {
  return {
    scenes: deepClone(getScenes()),
    favoriteIndices: deepClone(getFavoriteIndices()),
    deletedIndices: deepClone(getDeletedIndices()),
    collections: deepClone(getCollections()),
  }
}

function applySnapshot(snapshot: Snapshot): void {
  setScenes(deepClone(snapshot.scenes))
  setFavoriteIndices(deepClone(snapshot.favoriteIndices))
  setDeletedIndices(deepClone(snapshot.deletedIndices))
  setCollections(deepClone(snapshot.collections))
}

// --- Public API ---

/**
 * Aktuellen State als Snapshot auf den Undo-Stack legen.
 * WICHTIG: Muss VOR der State-Änderung aufgerufen werden (Fix #87).
 * Löscht den Redo-Stack (neue Aktion = kein Redo mehr).
 */
export function commit(): void {
  const snapshot = createSnapshot()
  undoStack.push(snapshot)
  redoStack = []

  if (undoStack.length > MAX_STACK_SIZE) {
    undoStack.shift()
  }

  setIsDirty(true)
}

/** Letzte Aktion rückgängig machen */
export function undo(): void {
  if (undoStack.length === 0) return

  // Aktuellen State auf Redo-Stack sichern
  redoStack.push(createSnapshot())

  // Vorherigen State wiederherstellen
  const previous = undoStack.pop()!
  applySnapshot(previous)
}

/** Letzte rückgängig gemachte Aktion wiederholen */
export function redo(): void {
  if (redoStack.length === 0) return

  // Aktuellen State auf Undo-Stack sichern
  undoStack.push(createSnapshot())

  // Nächsten State wiederherstellen
  const next = redoStack.pop()!
  applySnapshot(next)
}

/** Prüfen ob Undo verfügbar */
export function canUndo(): boolean {
  return undoStack.length > 0
}

/** Prüfen ob Redo verfügbar */
export function canRedo(): boolean {
  return redoStack.length > 0
}

/** Kompletten Undo/Redo-Verlauf löschen */
export function clear(): void {
  undoStack = []
  redoStack = []
}
