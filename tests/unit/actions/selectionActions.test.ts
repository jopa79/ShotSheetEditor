import { describe, it, expect, beforeEach } from 'vitest'
import * as selectionActions from '@lib/actions/selectionActions'
import * as undoRedo from '@lib/actions/undoRedo'
import {
  getSelectedIndices,
  setSelectedIndices,
  getFavoriteIndices,
  getDeletedIndices,
  setScenes,
  setFilterMode,
  resetAllStores,
} from '@lib/stores'
import { setDeletedIndices, setFavoriteIndices } from '@lib/stores/selectionState.svelte'
import type { Scene } from '@shared/models'

function createScenes(count: number): Scene[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    startTime: i * 5,
    endTime: (i + 1) * 5,
    duration: 5,
  }))
}

describe('selectionActions', () => {
  beforeEach(() => {
    resetAllStores()
    undoRedo.clear()
    setScenes(createScenes(5))
  })

  describe('selectShot', () => {
    it('fügt Index zur Selektion hinzu', () => {
      selectionActions.selectShot(2)
      expect(getSelectedIndices()).toContain(2)
    })

    it('entfernt Index bei erneutem Toggle', () => {
      selectionActions.selectShot(2)
      selectionActions.selectShot(2)
      expect(getSelectedIndices()).not.toContain(2)
    })

    it('erlaubt mehrere Selektionen', () => {
      selectionActions.selectShot(0)
      selectionActions.selectShot(3)
      expect(getSelectedIndices()).toEqual([0, 3])
    })
  })

  describe('selectRange', () => {
    it('selektiert den Bereich inklusiv', () => {
      selectionActions.selectRange(1, 3)
      expect(getSelectedIndices()).toEqual([1, 2, 3])
    })

    it('funktioniert auch bei umgekehrter Reihenfolge', () => {
      selectionActions.selectRange(3, 1)
      expect(getSelectedIndices()).toEqual([1, 2, 3])
    })

    it('überspringt gelöschte Indices', () => {
      setDeletedIndices([2])
      selectionActions.selectRange(1, 4)
      expect(getSelectedIndices()).toEqual([1, 3, 4])
    })

    it('behandelt negativen fromIdx korrekt', () => {
      selectionActions.selectRange(-1, 2)
      // selectShot(2) wird aufgerufen
      expect(getSelectedIndices()).toContain(2)
    })

    it('begrenzt auf scenes.length', () => {
      selectionActions.selectRange(3, 10)
      // Nur 3 und 4 sind gültig (5 Szenen, Index 0-4)
      expect(getSelectedIndices()).toEqual([3, 4])
    })
  })

  describe('selectAll', () => {
    it('selektiert alle sichtbaren Shots', () => {
      selectionActions.selectAll()
      expect(getSelectedIndices()).toEqual([0, 1, 2, 3, 4])
    })

    it('selektiert nur nicht-gelöschte Shots', () => {
      setDeletedIndices([1, 3])
      selectionActions.selectAll()
      expect(getSelectedIndices()).toEqual([0, 2, 4])
    })
  })

  describe('deselectAll', () => {
    it('leert die Selektion', () => {
      setSelectedIndices([0, 1, 2])
      selectionActions.deselectAll()
      expect(getSelectedIndices()).toEqual([])
    })
  })

  describe('invertSelection', () => {
    it('invertiert die Selektion der sichtbaren Shots', () => {
      setSelectedIndices([0, 2])
      selectionActions.invertSelection()
      expect(getSelectedIndices()).toEqual([1, 3, 4])
    })

    it('berücksichtigt gelöschte Shots', () => {
      setDeletedIndices([4])
      setSelectedIndices([0, 2])
      selectionActions.invertSelection()
      // Sichtbar: 0, 1, 2, 3 → invertiert (0, 2 sind selektiert): 1, 3
      expect(getSelectedIndices()).toEqual([1, 3])
    })
  })

  describe('toggleFavorite', () => {
    it('fügt Favorit hinzu', () => {
      selectionActions.toggleFavorite(2)
      expect(getFavoriteIndices()).toContain(2)
    })

    it('entfernt Favorit bei erneutem Toggle', () => {
      selectionActions.toggleFavorite(2)
      selectionActions.toggleFavorite(2)
      expect(getFavoriteIndices()).not.toContain(2)
    })

    it('erzeugt Undo-Eintrag', () => {
      selectionActions.toggleFavorite(0)
      expect(undoRedo.canUndo()).toBe(true)
    })
  })

  describe('favSelected / unfavSelected', () => {
    it('favSelected fügt alle selektierten zu Favoriten hinzu', () => {
      setSelectedIndices([1, 3])
      selectionActions.favSelected()
      expect(getFavoriteIndices()).toContain(1)
      expect(getFavoriteIndices()).toContain(3)
    })

    it('favSelected erstellt keine Duplikate', () => {
      setFavoriteIndices([1])
      setSelectedIndices([1, 3])
      selectionActions.favSelected()
      const count = getFavoriteIndices().filter((i) => i === 1).length
      expect(count).toBe(1)
    })

    it('unfavSelected entfernt selektierte von Favoriten', () => {
      setFavoriteIndices([0, 1, 2, 3])
      setSelectedIndices([1, 3])
      selectionActions.unfavSelected()
      expect(getFavoriteIndices()).toEqual([0, 2])
    })
  })

  describe('deleteSelected', () => {
    it('verschiebt selektierte Indices in deletedIndices', () => {
      setSelectedIndices([1, 3])
      selectionActions.deleteSelected()
      expect(getDeletedIndices()).toContain(1)
      expect(getDeletedIndices()).toContain(3)
    })

    it('leert die Selektion danach', () => {
      setSelectedIndices([1, 3])
      selectionActions.deleteSelected()
      expect(getSelectedIndices()).toEqual([])
    })

    it('tut nichts bei leerer Selektion', () => {
      selectionActions.deleteSelected()
      expect(getDeletedIndices()).toEqual([])
      // Kein Undo-Eintrag
      expect(undoRedo.canUndo()).toBe(false)
    })

    it('erzeugt Undo-Eintrag', () => {
      setSelectedIndices([0])
      selectionActions.deleteSelected()
      expect(undoRedo.canUndo()).toBe(true)
    })
  })

  describe('deleteSingle', () => {
    it('fügt Index zu deletedIndices hinzu', () => {
      selectionActions.deleteSingle(2)
      expect(getDeletedIndices()).toContain(2)
    })

    it('ignoriert bereits gelöschten Index', () => {
      setDeletedIndices([2])
      selectionActions.deleteSingle(2)
      // Kein Duplikat, kein neuer Undo-Eintrag
      expect(getDeletedIndices().filter((i) => i === 2)).toHaveLength(1)
    })
  })

  describe('restoreSingle', () => {
    it('entfernt Index aus deletedIndices', () => {
      setDeletedIndices([1, 2, 3])
      selectionActions.restoreSingle(2)
      expect(getDeletedIndices()).toEqual([1, 3])
    })

    it('erzeugt Undo-Eintrag', () => {
      setDeletedIndices([1])
      selectionActions.restoreSingle(1)
      expect(undoRedo.canUndo()).toBe(true)
    })
  })
})
