import { describe, it, expect, beforeEach } from 'vitest'
import {
  getGridSize,
  setGridSize,
  getFilterMode,
  setFilterMode,
  getActiveCollectionId,
  setActiveCollectionId,
  getCurrentShotIdx,
  setCurrentShotIdx,
  resetUiState,
} from '@lib/stores/uiState.svelte'

describe('uiState', () => {
  beforeEach(() => {
    resetUiState()
  })

  describe('Initialwerte', () => {
    it('gridSize ist 200', () => {
      expect(getGridSize()).toBe(200)
    })

    it('filterMode ist "all"', () => {
      expect(getFilterMode()).toBe('all')
    })

    it('activeCollectionId ist null', () => {
      expect(getActiveCollectionId()).toBeNull()
    })

    it('currentShotIdx ist -1', () => {
      expect(getCurrentShotIdx()).toBe(-1)
    })
  })

  describe('Setter/Getter Round-Trip', () => {
    it('gridSize setzen und lesen', () => {
      setGridSize(300)
      expect(getGridSize()).toBe(300)
    })

    it('filterMode auf "favorites" setzen', () => {
      setFilterMode('favorites')
      expect(getFilterMode()).toBe('favorites')
    })

    it('filterMode auf "collection" setzen', () => {
      setFilterMode('collection')
      expect(getFilterMode()).toBe('collection')
    })

    it('filterMode zurück auf "all" setzen', () => {
      setFilterMode('favorites')
      setFilterMode('all')
      expect(getFilterMode()).toBe('all')
    })

    it('activeCollectionId setzen und lesen', () => {
      setActiveCollectionId('col_abc')
      expect(getActiveCollectionId()).toBe('col_abc')
    })

    it('activeCollectionId auf null zurücksetzen', () => {
      setActiveCollectionId('col_abc')
      setActiveCollectionId(null)
      expect(getActiveCollectionId()).toBeNull()
    })

    it('currentShotIdx setzen und lesen', () => {
      setCurrentShotIdx(5)
      expect(getCurrentShotIdx()).toBe(5)
    })
  })

  describe('resetUiState', () => {
    it('setzt alle Werte auf Default zurück', () => {
      setGridSize(400)
      setFilterMode('favorites')
      setActiveCollectionId('col_xyz')
      setCurrentShotIdx(10)

      resetUiState()

      expect(getGridSize()).toBe(200)
      expect(getFilterMode()).toBe('all')
      expect(getActiveCollectionId()).toBeNull()
      expect(getCurrentShotIdx()).toBe(-1)
    })
  })
})
