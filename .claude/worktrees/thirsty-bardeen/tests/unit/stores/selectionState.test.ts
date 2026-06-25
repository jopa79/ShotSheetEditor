import { describe, it, expect, beforeEach } from 'vitest'
import {
  getSelectedIndices,
  setSelectedIndices,
  getFavoriteIndices,
  setFavoriteIndices,
  getDeletedIndices,
  setDeletedIndices,
  resetSelectionState,
} from '@lib/stores/selectionState.svelte'

describe('selectionState', () => {
  beforeEach(() => {
    resetSelectionState()
  })

  describe('Initialwerte', () => {
    it('selectedIndices ist ein leeres Array', () => {
      expect(getSelectedIndices()).toEqual([])
    })

    it('favoriteIndices ist ein leeres Array', () => {
      expect(getFavoriteIndices()).toEqual([])
    })

    it('deletedIndices ist ein leeres Array', () => {
      expect(getDeletedIndices()).toEqual([])
    })
  })

  describe('Setter/Getter Round-Trip', () => {
    it('selectedIndices setzen und lesen', () => {
      setSelectedIndices([0, 2, 4])
      expect(getSelectedIndices()).toEqual([0, 2, 4])
    })

    it('favoriteIndices setzen und lesen', () => {
      setFavoriteIndices([1, 3])
      expect(getFavoriteIndices()).toEqual([1, 3])
    })

    it('deletedIndices setzen und lesen', () => {
      setDeletedIndices([5, 7])
      expect(getDeletedIndices()).toEqual([5, 7])
    })

    it('leeres Array setzen funktioniert', () => {
      setSelectedIndices([1, 2])
      setSelectedIndices([])
      expect(getSelectedIndices()).toEqual([])
    })
  })

  describe('resetSelectionState', () => {
    it('setzt alle Werte auf leere Arrays zurück', () => {
      setSelectedIndices([0, 1, 2])
      setFavoriteIndices([3, 4])
      setDeletedIndices([5])

      resetSelectionState()

      expect(getSelectedIndices()).toEqual([])
      expect(getFavoriteIndices()).toEqual([])
      expect(getDeletedIndices()).toEqual([])
    })
  })
})
