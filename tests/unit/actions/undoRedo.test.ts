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

  describe('withUndo', () => {
    it('nimmt Snapshot VOR der Mutation — undo stellt alten State wieder her', () => {
      // Ausgangszustand: leer
      // withUndo kapselt Mutation
      undoRedo.withUndo(() => {
        setScenes([createScene(0)])
      })

      // Nach withUndo ist ein Undo möglich
      expect(undoRedo.canUndo()).toBe(true)

      // Undo stellt leeren Ausgangszustand wieder her
      undoRedo.undo()
      expect(getScenes()).toEqual([])
    })

    it('gibt den Rückgabewert der Mutation-Funktion weiter', () => {
      const result = undoRedo.withUndo(() => {
        setScenes([createScene(0)])
        return 42
      })

      expect(result).toBe(42)
    })

    it('löscht den Redo-Stack (konsistent mit commit())', () => {
      // Redo-State erzeugen
      undoRedo.commit()
      setScenes([createScene(0)])
      undoRedo.undo()
      expect(undoRedo.canRedo()).toBe(true)

      // withUndo löscht Redo — wie commit()
      undoRedo.withUndo(() => {
        setScenes([createScene(1)])
      })
      expect(undoRedo.canRedo()).toBe(false)
    })

    it('bei Exception in fn wird der Snapshot zurückgerollt', () => {
      // Ausgangszustand: 1 Szene, Stack leer
      setScenes([createScene(0)])
      const stackLengthVorher = undoRedo.canUndo() ? 1 : 0

      expect(() => {
        undoRedo.withUndo(() => {
          throw new Error('Mutation fehlgeschlagen')
        })
      }).toThrow('Mutation fehlgeschlagen')

      // Stack-Länge darf sich nicht verändert haben (kein leerer Undo-Schritt)
      const stackLengthNachher = undoRedo.canUndo() ? 1 : 0
      expect(stackLengthNachher).toBe(stackLengthVorher)
    })

    it('bei Exception wird der Stack-Zustand exakt wiederhergestellt', () => {
      // Zwei Commits im Stack
      undoRedo.commit()
      setScenes([createScene(0)])
      undoRedo.commit()
      setScenes([createScene(1)])

      // Stack hat 2 Einträge
      expect(undoRedo.canUndo()).toBe(true)

      // Fehlerhafte withUndo darf den Stack nicht verändern
      expect(() => {
        undoRedo.withUndo(() => {
          throw new Error('boom')
        })
      }).toThrow('boom')

      // Noch immer 2 Undos möglich
      undoRedo.undo()
      expect(getScenes()).toHaveLength(1)
      undoRedo.undo()
      expect(getScenes()).toHaveLength(0)
      expect(undoRedo.canUndo()).toBe(false)
    })

    it('bei Exception bleibt der Redo-Stack erhalten (kein Verlust nie-konsumierter Redo-Schritte)', () => {
      // Undo-Schritt aufbauen und konsumieren → es existiert ein Redo-Schritt
      undoRedo.withUndo(() => {
        setScenes([createScene(0)])
      })
      undoRedo.undo() // erzeugt einen Redo-Eintrag, State zurück auf []
      expect(undoRedo.canRedo()).toBe(true)

      // Fehlgeschlagene withUndo darf den Redo-Stack NICHT leeren (commit() würde ihn löschen)
      expect(() => {
        undoRedo.withUndo(() => {
          throw new Error('boom')
        })
      }).toThrow('boom')

      // Redo ist weiterhin verfügbar und funktioniert korrekt
      expect(undoRedo.canRedo()).toBe(true)
      undoRedo.redo()
      expect(getScenes()).toHaveLength(1)
    })

    it('bei Exception bleibt der State unverändert (Mutation hat nicht stattgefunden)', () => {
      setScenes([createScene(0)])

      expect(() => {
        undoRedo.withUndo(() => {
          throw new Error('Kein State-Change')
        })
      }).toThrow()

      // State bleibt wie vorher
      expect(getScenes()).toEqual([createScene(0)])
    })

    it('mehrfache withUndo-Aufrufe erzeugen mehrere Snapshots', () => {
      undoRedo.withUndo(() => {
        setScenes([createScene(0)])
      })
      undoRedo.withUndo(() => {
        setScenes([createScene(0), createScene(1)])
      })

      // 2x undo möglich
      undoRedo.undo()
      expect(getScenes()).toHaveLength(1)
      undoRedo.undo()
      expect(getScenes()).toHaveLength(0)
    })

    it('withUndo mit void-Funktion gibt undefined zurück', () => {
      const result = undoRedo.withUndo(() => {
        setScenes([createScene(0)])
      })

      expect(result).toBeUndefined()
    })
  })
})
