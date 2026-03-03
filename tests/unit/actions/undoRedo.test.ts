import { describe, it, expect, beforeEach } from 'vitest'
import * as undoRedo from '@lib/actions/undoRedo'
import {
  getScenes,
  setScenes,
  getFavoriteIndices,
  setFavoriteIndices,
  getDeletedIndices,
  setDeletedIndices,
  getCollections,
  setCollections,
  resetAllStores,
} from '@lib/stores'
import type { Scene } from '@shared/models'

function createScene(index: number): Scene {
  return { index, startTime: index * 5, endTime: (index + 1) * 5, duration: 5 }
}

describe('undoRedo', () => {
  beforeEach(() => {
    resetAllStores()
    undoRedo.clear()
  })

  describe('canUndo / canRedo', () => {
    it('initial ist canUndo false', () => {
      expect(undoRedo.canUndo()).toBe(false)
    })

    it('initial ist canRedo false', () => {
      expect(undoRedo.canRedo()).toBe(false)
    })
  })

  describe('commit', () => {
    it('nach commit() ist canUndo true', () => {
      undoRedo.commit()
      expect(undoRedo.canUndo()).toBe(true)
    })

    it('commit() löscht den Redo-Stack', () => {
      // Redo-State erzeugen
      undoRedo.commit()
      setScenes([createScene(0)])
      undoRedo.undo()
      expect(undoRedo.canRedo()).toBe(true)

      // Neuer commit() löscht Redo
      undoRedo.commit()
      expect(undoRedo.canRedo()).toBe(false)
    })
  })

  describe('undo', () => {
    it('stellt vorherigen State wieder her', () => {
      // Ausgangszustand: leer
      undoRedo.commit()

      // Szenen hinzufügen
      setScenes([createScene(0), createScene(1)])

      // Undo: zurück zum leeren Zustand
      undoRedo.undo()
      expect(getScenes()).toEqual([])
    })

    it('stellt Favoriten wieder her', () => {
      setFavoriteIndices([0, 1])
      undoRedo.commit()
      setFavoriteIndices([0, 1, 2])

      undoRedo.undo()
      expect(getFavoriteIndices()).toEqual([0, 1])
    })

    it('stellt deletedIndices wieder her', () => {
      undoRedo.commit()
      setDeletedIndices([3])

      undoRedo.undo()
      expect(getDeletedIndices()).toEqual([])
    })

    it('stellt Collections wieder her', () => {
      undoRedo.commit()
      setCollections([{ id: 'col_1', name: 'Test', indices: [0] }])

      undoRedo.undo()
      expect(getCollections()).toEqual([])
    })

    it('tut nichts bei leerem Undo-Stack', () => {
      setScenes([createScene(0)])
      undoRedo.undo()
      expect(getScenes()).toEqual([createScene(0)])
    })
  })

  describe('redo', () => {
    it('stellt nach undo den neueren State wieder her', () => {
      undoRedo.commit()
      const scenes = [createScene(0), createScene(1)]
      setScenes(scenes)

      undoRedo.undo()
      expect(getScenes()).toEqual([])

      undoRedo.redo()
      expect(getScenes()).toEqual(scenes)
    })

    it('tut nichts bei leerem Redo-Stack', () => {
      setScenes([createScene(0)])
      undoRedo.redo()
      expect(getScenes()).toEqual([createScene(0)])
    })
  })

  describe('undo/redo Cycle', () => {
    it('mehrfaches undo/redo bewahrt korrekte Reihenfolge', () => {
      // State 0: leer
      undoRedo.commit()
      setScenes([createScene(0)])

      // State 1: 1 Szene
      undoRedo.commit()
      setScenes([createScene(0), createScene(1)])

      // State 2: 2 Szenen — aktuell

      // Undo auf State 1
      undoRedo.undo()
      expect(getScenes()).toHaveLength(1)

      // Undo auf State 0
      undoRedo.undo()
      expect(getScenes()).toHaveLength(0)

      // Redo auf State 1
      undoRedo.redo()
      expect(getScenes()).toHaveLength(1)

      // Redo auf State 2
      undoRedo.redo()
      expect(getScenes()).toHaveLength(2)
    })
  })

  describe('Max Stack Size (50)', () => {
    it('bei 51 commits wird der älteste entfernt', () => {
      // 51 verschiedene Zustände committen
      for (let i = 0; i < 51; i++) {
        undoRedo.commit()
        setScenes([createScene(i)])
      }

      // Wir haben 50 Einträge im Undo-Stack (51. hat den 1. verdrängt)
      // 50x undo möglich
      let undoCount = 0
      while (undoRedo.canUndo()) {
        undoRedo.undo()
        undoCount++
      }
      expect(undoCount).toBe(50)
    })
  })

  describe('clear', () => {
    it('leert beide Stacks', () => {
      undoRedo.commit()
      setScenes([createScene(0)])
      undoRedo.commit()
      setScenes([createScene(1)])
      undoRedo.undo()

      expect(undoRedo.canUndo()).toBe(true)
      expect(undoRedo.canRedo()).toBe(true)

      undoRedo.clear()

      expect(undoRedo.canUndo()).toBe(false)
      expect(undoRedo.canRedo()).toBe(false)
    })
  })
})
