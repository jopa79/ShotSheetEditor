import { describe, it, expect, beforeEach } from 'vitest'
import * as collectionActions from '@lib/actions/collectionActions'
import * as undoRedo from '@lib/actions/undoRedo'
import {
  getCollections,
  setCollections,
  getFilterMode,
  getActiveCollectionId,
  resetAllStores,
} from '@lib/stores'

describe('collectionActions', () => {
  beforeEach(() => {
    resetAllStores()
    undoRedo.clear()
  })

  describe('createCollection', () => {
    it('erstellt eine neue Collection mit Name', () => {
      const col = collectionActions.createCollection('Highlights')
      expect(col.name).toBe('Highlights')
      expect(col.id).toMatch(/^col_/)
      expect(col.indices).toEqual([])
    })

    it('erstellt Collection mit initialen Indices', () => {
      const col = collectionActions.createCollection('Selection', [0, 2, 4])
      expect(col.indices).toEqual([0, 2, 4])
    })

    it('entfernt Duplikate in Indices', () => {
      const col = collectionActions.createCollection('Test', [1, 1, 3, 3])
      expect(col.indices).toEqual([1, 3])
    })

    it('sortiert Indices aufsteigend', () => {
      const col = collectionActions.createCollection('Test', [4, 1, 3])
      expect(col.indices).toEqual([1, 3, 4])
    })

    it('wirft Fehler bei leerem Name', () => {
      expect(() => collectionActions.createCollection('')).toThrow()
    })

    it('wirft Fehler bei Whitespace-only Name', () => {
      expect(() => collectionActions.createCollection('   ')).toThrow()
    })

    it('trimmt den Namen', () => {
      const col = collectionActions.createCollection('  Highlights  ')
      expect(col.name).toBe('Highlights')
    })

    it('fügt Collection zum Store hinzu', () => {
      collectionActions.createCollection('Test')
      expect(getCollections()).toHaveLength(1)
    })

    it('erzeugt Undo-Eintrag', () => {
      collectionActions.createCollection('Test')
      expect(undoRedo.canUndo()).toBe(true)
    })
  })

  describe('deleteCollection', () => {
    it('entfernt Collection aus dem Store', () => {
      const col = collectionActions.createCollection('Test')
      undoRedo.clear()

      collectionActions.deleteCollection(col.id)
      expect(getCollections()).toHaveLength(0)
    })

    it('setzt Filter zurück wenn gelöschte Collection aktiv war', () => {
      const col = collectionActions.createCollection('Test')
      collectionActions.setActiveCollection(col.id)
      expect(getFilterMode()).toBe('collection')

      collectionActions.deleteCollection(col.id)
      expect(getFilterMode()).toBe('all')
      expect(getActiveCollectionId()).toBeNull()
    })

    it('lässt andere Collections unberührt', () => {
      const col1 = collectionActions.createCollection('A')
      const col2 = collectionActions.createCollection('B')
      undoRedo.clear()

      collectionActions.deleteCollection(col1.id)
      expect(getCollections()).toHaveLength(1)
      expect(getCollections()[0].id).toBe(col2.id)
    })

    it('tut nichts bei nicht-existierender ID', () => {
      collectionActions.createCollection('Test')
      undoRedo.clear()

      collectionActions.deleteCollection('non_existent')
      expect(getCollections()).toHaveLength(1)
    })
  })

  describe('renameCollection', () => {
    it('benennt Collection um', () => {
      const col = collectionActions.createCollection('Old Name')
      undoRedo.clear()

      collectionActions.renameCollection(col.id, 'New Name')
      expect(getCollections()[0].name).toBe('New Name')
    })

    it('trimmt den neuen Namen', () => {
      const col = collectionActions.createCollection('Test')
      collectionActions.renameCollection(col.id, '  Trimmed  ')
      expect(getCollections().find((c) => c.id === col.id)?.name).toBe('Trimmed')
    })

    it('wirft Fehler bei leerem Name', () => {
      const col = collectionActions.createCollection('Test')
      expect(() => collectionActions.renameCollection(col.id, '')).toThrow()
    })

    it('erzeugt Undo-Eintrag', () => {
      const col = collectionActions.createCollection('Test')
      undoRedo.clear()

      collectionActions.renameCollection(col.id, 'Renamed')
      expect(undoRedo.canUndo()).toBe(true)
    })
  })

  describe('addToCollection', () => {
    it('fügt Indices zur Collection hinzu', () => {
      const col = collectionActions.createCollection('Test', [0])
      undoRedo.clear()

      collectionActions.addToCollection(col.id, [2, 4])
      const updated = getCollections().find((c) => c.id === col.id)!
      expect(updated.indices).toEqual([0, 2, 4])
    })

    it('erzeugt keine Duplikate', () => {
      const col = collectionActions.createCollection('Test', [0, 2])
      undoRedo.clear()

      collectionActions.addToCollection(col.id, [2, 4])
      const updated = getCollections().find((c) => c.id === col.id)!
      expect(updated.indices).toEqual([0, 2, 4])
    })

    it('sortiert Indices aufsteigend', () => {
      const col = collectionActions.createCollection('Test')
      collectionActions.addToCollection(col.id, [4, 1, 3])
      const updated = getCollections().find((c) => c.id === col.id)!
      expect(updated.indices).toEqual([1, 3, 4])
    })
  })

  describe('removeFromCollection', () => {
    it('entfernt Indices aus der Collection', () => {
      const col = collectionActions.createCollection('Test', [0, 1, 2, 3])
      undoRedo.clear()

      collectionActions.removeFromCollection(col.id, [1, 3])
      const updated = getCollections().find((c) => c.id === col.id)!
      expect(updated.indices).toEqual([0, 2])
    })

    it('ignoriert nicht-vorhandene Indices', () => {
      const col = collectionActions.createCollection('Test', [0, 1])
      undoRedo.clear()

      collectionActions.removeFromCollection(col.id, [5, 10])
      const updated = getCollections().find((c) => c.id === col.id)!
      expect(updated.indices).toEqual([0, 1])
    })
  })

  describe('setActiveCollection / clearActiveCollection', () => {
    it('setzt FilterMode auf "collection" und activeCollectionId', () => {
      const col = collectionActions.createCollection('Test')
      collectionActions.setActiveCollection(col.id)

      expect(getFilterMode()).toBe('collection')
      expect(getActiveCollectionId()).toBe(col.id)
    })

    it('clearActiveCollection setzt zurück auf "all"', () => {
      const col = collectionActions.createCollection('Test')
      collectionActions.setActiveCollection(col.id)
      collectionActions.clearActiveCollection()

      expect(getFilterMode()).toBe('all')
      expect(getActiveCollectionId()).toBeNull()
    })
  })

  describe('getCollection', () => {
    it('findet Collection per ID', () => {
      const col = collectionActions.createCollection('Findable')
      const found = collectionActions.getCollection(col.id)
      expect(found).not.toBeNull()
      expect(found!.name).toBe('Findable')
    })

    it('gibt null bei nicht-existierender ID zurück', () => {
      expect(collectionActions.getCollection('non_existent')).toBeNull()
    })
  })
})
