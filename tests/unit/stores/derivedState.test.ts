import { describe, it, expect, beforeEach } from 'vitest'
import {
  setScenes,
  setCollections,
  setFilterMode,
  setActiveCollectionId,
  setCurrentShotIdx,
} from '@lib/stores'
import { setVideoPath, setVideoMeta } from '@lib/stores/videoState.svelte'
import { setDeletedIndices, setFavoriteIndices } from '@lib/stores/selectionState.svelte'
import { resetAllStores } from '@lib/stores'
import { getVisibleScenes, getCurrentScene, hasVideo } from '@lib/stores/derivedState.svelte'
import type { Scene } from '@shared/models'

// Test-Szenen
function createTestScenes(count: number): Scene[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    startTime: i * 5,
    endTime: (i + 1) * 5,
    duration: 5,
    thumbPath: `/tmp/thumb_${i}.jpg`,
  }))
}

describe('derivedState', () => {
  beforeEach(() => {
    resetAllStores()
  })

  describe('getVisibleScenes', () => {
    it('gibt alle Szenen zurück wenn kein Filter aktiv', () => {
      const scenes = createTestScenes(5)
      setScenes(scenes)

      const visible = getVisibleScenes()
      expect(visible).toHaveLength(5)
      expect(visible[0].originalIdx).toBe(0)
      expect(visible[4].originalIdx).toBe(4)
    })

    it('filtert gelöschte Szenen aus', () => {
      setScenes(createTestScenes(5))
      setDeletedIndices([1, 3])

      const visible = getVisibleScenes()
      expect(visible).toHaveLength(3)
      expect(visible.map((s) => s.originalIdx)).toEqual([0, 2, 4])
    })

    it('filtert nur Favoriten im favorites-Modus', () => {
      setScenes(createTestScenes(5))
      setFavoriteIndices([0, 2, 4])
      setFilterMode('favorites')

      const visible = getVisibleScenes()
      expect(visible).toHaveLength(3)
      expect(visible.map((s) => s.originalIdx)).toEqual([0, 2, 4])
    })

    it('kombiniert Favorites und Deleted korrekt', () => {
      setScenes(createTestScenes(5))
      setFavoriteIndices([0, 1, 2])
      setDeletedIndices([1])
      setFilterMode('favorites')

      const visible = getVisibleScenes()
      // Favorit 0 und 2 sichtbar, Favorit 1 gelöscht
      expect(visible).toHaveLength(2)
      expect(visible.map((s) => s.originalIdx)).toEqual([0, 2])
    })

    it('filtert nach Collection', () => {
      setScenes(createTestScenes(5))
      setCollections([{ id: 'col_1', name: 'Test', indices: [1, 3] }])
      setFilterMode('collection')
      setActiveCollectionId('col_1')

      const visible = getVisibleScenes()
      expect(visible).toHaveLength(2)
      expect(visible.map((s) => s.originalIdx)).toEqual([1, 3])
    })

    it('zeigt alle Szenen bei Collection-Filter ohne activeCollectionId', () => {
      setScenes(createTestScenes(3))
      setFilterMode('collection')
      // activeCollectionId bleibt null

      const visible = getVisibleScenes()
      // Ohne activeCollectionId wird collectionSet null → kein Filter
      expect(visible).toHaveLength(3)
    })

    it('gibt leeres Array bei leeren Szenen zurück', () => {
      const visible = getVisibleScenes()
      expect(visible).toEqual([])
    })

    it('enthält originalIdx im Ergebnis', () => {
      setScenes(createTestScenes(3))
      setDeletedIndices([0])

      const visible = getVisibleScenes()
      expect(visible[0].originalIdx).toBe(1)
      expect(visible[0].index).toBe(1)
    })
  })

  describe('getCurrentScene', () => {
    it('gibt null bei ungültigem Index (-1) zurück', () => {
      setScenes(createTestScenes(3))
      setCurrentShotIdx(-1)
      expect(getCurrentScene()).toBeNull()
    })

    it('gibt korrekte Szene bei gültigem Index zurück', () => {
      const scenes = createTestScenes(3)
      setScenes(scenes)
      setCurrentShotIdx(1)

      const result = getCurrentScene()
      expect(result).toEqual(scenes[1])
    })

    it('gibt null bei Index außerhalb der Grenzen zurück', () => {
      setScenes(createTestScenes(3))
      setCurrentShotIdx(10)
      expect(getCurrentScene()).toBeNull()
    })

    it('gibt null bei leeren Szenen zurück', () => {
      setCurrentShotIdx(0)
      expect(getCurrentScene()).toBeNull()
    })
  })

  describe('hasVideo', () => {
    it('gibt false ohne Video-Daten zurück', () => {
      expect(hasVideo()).toBe(false)
    })

    it('gibt false wenn nur videoPath gesetzt ist', () => {
      setVideoPath('/tmp/video.mp4')
      expect(hasVideo()).toBe(false)
    })

    it('gibt false wenn nur videoMeta gesetzt ist', () => {
      setVideoMeta({ success: true, data: { codec: 'h264', width: 1920, height: 1080, duration: 60, fps: 30, size: 1000, format: 'mp4' } })
      expect(hasVideo()).toBe(false)
    })

    it('gibt true wenn beides gesetzt ist', () => {
      setVideoPath('/tmp/video.mp4')
      setVideoMeta({ success: true, data: { codec: 'h264', width: 1920, height: 1080, duration: 60, fps: 30, size: 1000, format: 'mp4' } })
      expect(hasVideo()).toBe(true)
    })
  })
})
