import { describe, it, expect, beforeEach } from 'vitest'
import {
  getScenes,
  setScenes,
  getCollections,
  setCollections,
  getProjectPath,
  setProjectPath,
  getProjectData,
  setProjectData,
  getIsDirty,
  setIsDirty,
  getThreshold,
  setThreshold,
  resetAppState,
} from '@lib/stores/appState.svelte'
import type { Scene, Collection, ProjectData } from '@shared/models'

describe('appState', () => {
  beforeEach(() => {
    resetAppState()
  })

  describe('Initialwerte', () => {
    it('scenes ist ein leeres Array', () => {
      expect(getScenes()).toEqual([])
    })

    it('collections ist ein leeres Array', () => {
      expect(getCollections()).toEqual([])
    })

    it('projectPath ist null', () => {
      expect(getProjectPath()).toBeNull()
    })

    it('projectData ist null', () => {
      expect(getProjectData()).toBeNull()
    })

    it('isDirty ist false', () => {
      expect(getIsDirty()).toBe(false)
    })

    it('threshold ist 0.3', () => {
      expect(getThreshold()).toBe(0.3)
    })
  })

  describe('Setter/Getter Round-Trip', () => {
    it('scenes setzen und lesen', () => {
      const scenes: Scene[] = [
        { index: 0, startTime: 0, endTime: 5, duration: 5 },
        { index: 1, startTime: 5, endTime: 10, duration: 5, thumbPath: '/tmp/thumb.jpg' },
      ]
      setScenes(scenes)
      expect(getScenes()).toEqual(scenes)
    })

    it('collections setzen und lesen', () => {
      const cols: Collection[] = [
        { id: 'col_1', name: 'Test', indices: [0, 1] },
      ]
      setCollections(cols)
      expect(getCollections()).toEqual(cols)
    })

    it('projectPath setzen und lesen', () => {
      setProjectPath('/tmp/project.json')
      expect(getProjectPath()).toBe('/tmp/project.json')
    })

    it('projectData setzen und lesen', () => {
      const data: ProjectData = {
        videoPath: '/tmp/video.mp4',
        scenes: [],
        collections: [],
        favoriteIndices: [],
        deletedIndices: [],
        threshold: 0.3,
        gridSize: 200,
      }
      setProjectData(data)
      expect(getProjectData()).toEqual(data)
    })

    it('isDirty setzen und lesen', () => {
      setIsDirty(true)
      expect(getIsDirty()).toBe(true)
    })

    it('threshold setzen und lesen', () => {
      setThreshold(0.5)
      expect(getThreshold()).toBe(0.5)
    })
  })

  describe('resetAppState', () => {
    it('setzt alle Werte auf Default zurück', () => {
      // Werte ändern
      setScenes([{ index: 0, startTime: 0, endTime: 5, duration: 5 }])
      setCollections([{ id: 'col_1', name: 'Test', indices: [] }])
      setProjectPath('/tmp/project.json')
      setIsDirty(true)
      setThreshold(0.7)

      // Reset
      resetAppState()

      // Prüfen
      expect(getScenes()).toEqual([])
      expect(getCollections()).toEqual([])
      expect(getProjectPath()).toBeNull()
      expect(getProjectData()).toBeNull()
      expect(getIsDirty()).toBe(false)
      expect(getThreshold()).toBe(0.3)
    })
  })
})
