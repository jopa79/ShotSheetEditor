import { describe, it, expect, beforeEach, vi } from 'vitest'

// IPC-Bridge mocken — muss vor dem Import von projectActions passieren
vi.mock('@lib/ipc/bridge', () => ({
  openProjectDialog: vi.fn(),
  saveProjectDialog: vi.fn(),
  openProject: vi.fn(),
  saveProject: vi.fn(),
  unsavedChangesDialog: vi.fn(),
  getVideoMeta: vi.fn(),
  cancelProxy: vi.fn(),
}))

// videoActions mocken — openVideoFromPath + callPauseAndReset
vi.mock('@lib/actions/videoActions', () => ({
  openVideoFromPath: vi.fn(),
  callPauseAndReset: vi.fn(),
}))

// toastManager mocken — showToast erfassen ohne Side-Effects
vi.mock('@lib/actions/toastManager', () => ({
  showToast: vi.fn(),
}))

import * as projectActions from '@lib/actions/projectActions'
import * as ipc from '@lib/ipc/bridge'
import { openVideoFromPath, callPauseAndReset } from '@lib/actions/videoActions'
import { showToast } from '@lib/actions/toastManager'
import {
  getVideoPath,
  setVideoPath,
  getScenes,
  setScenes,
  getCollections,
  getProjectPath,
  setProjectPath,
  getThreshold,
  getGridSize,
  getFavoriteIndices,
  getDeletedIndices,
  getIsDirty,
  setIsDirty,
  resetAllStores,
} from '@lib/stores'

// Typisierte Mocks
const mockIpc = vi.mocked(ipc)
const mockOpenVideoFromPath = vi.mocked(openVideoFromPath)
const mockCallPauseAndReset = vi.mocked(callPauseAndReset)
const mockShowToast = vi.mocked(showToast)

describe('projectActions', () => {
  beforeEach(() => {
    resetAllStores()
    vi.clearAllMocks()
  })

  // ===== newProject =====

  describe('newProject', () => {
    it('setzt alle Stores auf Defaults zurueck', () => {
      // State mit Daten fuellen
      setVideoPath('/some/video.mp4')
      setScenes([{ index: 0, startTime: 0 }] as never[])
      setIsDirty(true)

      projectActions.newProject()

      expect(getVideoPath()).toBeNull()
      expect(getScenes()).toEqual([])
      expect(getCollections()).toEqual([])
      expect(getIsDirty()).toBe(false)
      expect(getThreshold()).toBe(0.3)
      expect(getGridSize()).toBe(200)
    })

    it('zeigt Toast an', () => {
      projectActions.newProject()
      expect(mockShowToast).toHaveBeenCalledWith('New project created', 'info')
    })
  })

  // ===== saveProject =====

  describe('saveProject', () => {
    it('zeigt Warnung wenn kein Video geladen', async () => {
      await projectActions.saveProject()
      expect(mockShowToast).toHaveBeenCalledWith('No project to save', 'warning')
    })

    it('zeigt Warnung wenn kein ProjectPath', async () => {
      setVideoPath('/video.mp4')
      // projectPath bleibt null
      await projectActions.saveProject()
      expect(mockShowToast).toHaveBeenCalledWith('No project to save', 'warning')
    })

    it('speichert Projekt erfolgreich', async () => {
      setVideoPath('/video.mp4')
      setProjectPath('/project')
      setIsDirty(true)
      mockIpc.saveProject.mockResolvedValue({ success: true })

      await projectActions.saveProject()

      expect(mockIpc.saveProject).toHaveBeenCalledWith('/project', expect.objectContaining({
        videoPath: '/video.mp4',
        scenes: [],
        threshold: 0.3,
        gridSize: 200,
      }))
      expect(getIsDirty()).toBe(false)
      expect(mockShowToast).toHaveBeenCalledWith('Project saved', 'success')
    })

    it('zeigt Fehler bei fehlgeschlagenem Save', async () => {
      setVideoPath('/video.mp4')
      setProjectPath('/project')
      mockIpc.saveProject.mockResolvedValue({ success: false, error: 'Disk full' })

      await projectActions.saveProject()

      expect(mockShowToast).toHaveBeenCalledWith('Disk full', 'error')
    })
  })

  // ===== saveProjectAs =====

  describe('saveProjectAs', () => {
    it('zeigt Warnung wenn kein Video geladen', async () => {
      await projectActions.saveProjectAs()
      expect(mockShowToast).toHaveBeenCalledWith(
        'No video loaded — nothing to save',
        'warning',
      )
    })

    it('bricht ab wenn Dialog canceled', async () => {
      setVideoPath('/video.mp4')
      mockIpc.saveProjectDialog.mockResolvedValue({ success: false, error: 'Canceled' })

      await projectActions.saveProjectAs()

      expect(mockIpc.saveProject).not.toHaveBeenCalled()
    })

    it('speichert unter neuem Pfad und aktualisiert ProjectPath', async () => {
      setVideoPath('/video.mp4')
      setProjectPath('/old-project')
      setIsDirty(true)
      mockIpc.saveProjectDialog.mockResolvedValue({ success: true, path: '/new-project' })
      mockIpc.saveProject.mockResolvedValue({ success: true })

      await projectActions.saveProjectAs()

      expect(mockIpc.saveProject).toHaveBeenCalledWith('/new-project', expect.objectContaining({
        videoPath: '/video.mp4',
      }))
      expect(getProjectPath()).toBe('/new-project')
      expect(getIsDirty()).toBe(false)
      expect(mockShowToast).toHaveBeenCalledWith('Project saved', 'success')
    })

    it('zeigt Fehler wenn Save fehlschlaegt', async () => {
      setVideoPath('/video.mp4')
      mockIpc.saveProjectDialog.mockResolvedValue({ success: true, path: '/new' })
      mockIpc.saveProject.mockResolvedValue({ success: false, error: 'Permission denied' })

      await projectActions.saveProjectAs()

      expect(mockShowToast).toHaveBeenCalledWith('Permission denied', 'error')
    })
  })

  // ===== openProject =====

  describe('openProject', () => {
    it('bricht ab wenn Dialog canceled', async () => {
      mockIpc.openProjectDialog.mockResolvedValue({ success: false, error: 'Canceled' })

      await projectActions.openProject()

      expect(mockIpc.openProject).not.toHaveBeenCalled()
    })

    it('zeigt isDirty-Dialog wenn ungespeicherte Aenderungen', async () => {
      setIsDirty(true)
      mockIpc.unsavedChangesDialog.mockResolvedValue({ success: true, response: 'discard' as unknown as number })
      mockIpc.openProjectDialog.mockResolvedValue({ success: true, path: '/project' })
      mockIpc.openProject.mockResolvedValue({
        success: true,
        data: { videoPath: null, scenes: [] },
      })

      await projectActions.openProject()

      expect(mockIpc.unsavedChangesDialog).toHaveBeenCalled()
      expect(mockIpc.openProjectDialog).toHaveBeenCalled()
    })

    it('bricht ab wenn isDirty-Dialog mit cancel beantwortet', async () => {
      setIsDirty(true)
      mockIpc.unsavedChangesDialog.mockResolvedValue({ success: true, response: 'cancel' as unknown as number })

      await projectActions.openProject()

      expect(mockIpc.openProjectDialog).not.toHaveBeenCalled()
    })

    it('speichert erst wenn isDirty-Dialog mit save beantwortet', async () => {
      setIsDirty(true)
      setVideoPath('/video.mp4')
      setProjectPath('/project')
      mockIpc.unsavedChangesDialog.mockResolvedValue({ success: true, response: 'save' as unknown as number })
      mockIpc.saveProject.mockResolvedValue({ success: true })
      mockIpc.openProjectDialog.mockResolvedValue({ success: true, path: '/new-project' })
      mockIpc.openProject.mockResolvedValue({
        success: true,
        data: { videoPath: null, scenes: [] },
      })

      await projectActions.openProject()

      expect(mockIpc.saveProject).toHaveBeenCalled()
      expect(mockIpc.openProjectDialog).toHaveBeenCalled()
    })

    it('laedt Projekt und befuellt State', async () => {
      const projectData = {
        videoPath: '/project/video.mp4',
        scenes: [{ index: 0, startTime: 1.5 }],
        favoriteIndices: [0],
        deletedIndices: [],
        collections: [{ id: 'col_1', name: 'Test', indices: [0] }],
        threshold: 0.25,
        gridSize: 300,
      }
      mockIpc.openProjectDialog.mockResolvedValue({ success: true, path: '/project' })
      mockIpc.openProject.mockResolvedValue({ success: true, data: projectData })
      mockOpenVideoFromPath.mockResolvedValue()

      await projectActions.openProject()

      expect(getScenes()).toEqual([{ index: 0, startTime: 1.5 }])
      expect(getFavoriteIndices()).toEqual([0])
      expect(getDeletedIndices()).toEqual([])
      expect(getCollections()).toEqual([{ id: 'col_1', name: 'Test', indices: [0] }])
      expect(getThreshold()).toBe(0.25)
      expect(getGridSize()).toBe(300)
      expect(getProjectPath()).toBe('/project')
      expect(getIsDirty()).toBe(false)
    })

    it('laedt Video mit skipStateReset', async () => {
      mockIpc.openProjectDialog.mockResolvedValue({ success: true, path: '/project' })
      mockIpc.openProject.mockResolvedValue({
        success: true,
        data: { videoPath: '/project/video.mp4', scenes: [] },
      })
      mockOpenVideoFromPath.mockResolvedValue()

      await projectActions.openProject()

      expect(mockOpenVideoFromPath).toHaveBeenCalledWith(
        '/project/video.mp4',
        { skipStateReset: true },
      )
    })

    it('ruft callPauseAndReset auf', async () => {
      mockIpc.openProjectDialog.mockResolvedValue({ success: true, path: '/project' })
      mockIpc.openProject.mockResolvedValue({
        success: true,
        data: { videoPath: null, scenes: [] },
      })

      await projectActions.openProject()

      expect(mockCallPauseAndReset).toHaveBeenCalled()
    })

    it('verwendet defensive Defaults bei fehlenden Feldern', async () => {
      mockIpc.openProjectDialog.mockResolvedValue({ success: true, path: '/project' })
      // Projekt mit leeren/fehlenden Daten
      mockIpc.openProject.mockResolvedValue({
        success: true,
        data: {},
      })

      await projectActions.openProject()

      expect(getScenes()).toEqual([])
      expect(getFavoriteIndices()).toEqual([])
      expect(getDeletedIndices()).toEqual([])
      expect(getCollections()).toEqual([])
      expect(getThreshold()).toBe(0.3)
      expect(getGridSize()).toBe(200)
    })

    it('zeigt Warnung wenn Video-Datei nicht gefunden', async () => {
      mockIpc.openProjectDialog.mockResolvedValue({ success: true, path: '/project' })
      mockIpc.openProject.mockResolvedValue({
        success: true,
        data: { videoPath: '/missing/video.mp4', scenes: [] },
      })
      mockOpenVideoFromPath.mockRejectedValue(new Error('File not found'))

      await projectActions.openProject()

      expect(mockShowToast).toHaveBeenCalledWith(
        'Project loaded, but video file not found',
        'warning',
      )
    })

    it('zeigt Fehler wenn Projekt-Laden fehlschlaegt', async () => {
      mockIpc.openProjectDialog.mockResolvedValue({ success: true, path: '/project' })
      mockIpc.openProject.mockResolvedValue({
        success: false,
        error: 'Invalid project: missing project.json',
      })

      await projectActions.openProject()

      expect(mockShowToast).toHaveBeenCalledWith(
        'Invalid project: missing project.json',
        'error',
      )
    })

    it('ueberspringt isDirty-Dialog wenn nicht dirty', async () => {
      setIsDirty(false)
      mockIpc.openProjectDialog.mockResolvedValue({ success: true, path: '/project' })
      mockIpc.openProject.mockResolvedValue({
        success: true,
        data: { scenes: [] },
      })

      await projectActions.openProject()

      expect(mockIpc.unsavedChangesDialog).not.toHaveBeenCalled()
    })

    it('laedt kein Video wenn videoPath null', async () => {
      mockIpc.openProjectDialog.mockResolvedValue({ success: true, path: '/project' })
      mockIpc.openProject.mockResolvedValue({
        success: true,
        data: { videoPath: null, scenes: [] },
      })

      await projectActions.openProject()

      expect(mockOpenVideoFromPath).not.toHaveBeenCalled()
      expect(mockShowToast).toHaveBeenCalledWith('Project loaded', 'success')
    })
  })
})
