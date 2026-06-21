// projectActions.ts — Projekt-Aktionen (New, Save, Open)
// Ersetzt V1 toolbar.js (saveProject, openProject, newProject)

import * as ipc from '../ipc/bridge'
import {
  getVideoPath,
  getScenes,
  getCollections,
  getProjectPath,
  getThreshold,
  getGridSize,
  getFavoriteIndices,
  getDeletedIndices,
  getIsDirty,
  setIsDirty,
  setVideoPath,
  setVideoMeta,
  setScenes,
  setCollections,
  setProjectPath,
  setProjectData,
  setThreshold,
  setGridSize,
  setCurrentShotIdx,
} from '../stores'
import { resetSelectionState, setFavoriteIndices, setDeletedIndices } from '../stores'
import * as undoRedo from './undoRedo'
import { showToast } from './toastManager'
import { openVideoFromPath, callPauseAndReset } from './videoActions'

/**
 * Projektdaten aus Stores sammeln — JSON round-trip entfernt Svelte $state Proxies
 * damit die Daten ueber IPC (structuredClone) serialisierbar sind.
 */
function collectProjectData() {
  return JSON.parse(JSON.stringify({
    videoPath: getVideoPath(),
    scenes: getScenes(),
    favoriteIndices: getFavoriteIndices(),
    deletedIndices: getDeletedIndices(),
    collections: getCollections(),
    threshold: getThreshold(),
    gridSize: getGridSize(),
  }))
}

/**
 * Neues Projekt erstellen — State zurücksetzen
 */
export function newProject(): void {
  // Datenverlust-Check (Fix #131) wird im Aufrufer (menuAction) gemacht
  resetSelectionState()
  undoRedo.clear()

  setVideoPath(null)
  setVideoMeta(null)
  setScenes([])
  setCollections([])
  setProjectPath(null)
  setProjectData(null)
  setThreshold(0.3)
  setGridSize(200)
  setCurrentShotIdx(-1)
  setIsDirty(false)

  showToast('New project created', 'info')
}

/**
 * Projekt speichern
 */
export async function saveProject(): Promise<void> {
  const videoPath = getVideoPath()
  const projectPath = getProjectPath()
  if (!videoPath || !projectPath) {
    showToast('No project to save', 'warning')
    return
  }

  try {
    const data = collectProjectData()

    const result = await ipc.saveProject(projectPath, data)
    if (result?.success) {
      setIsDirty(false)
      showToast('Project saved', 'success')
    } else {
      showToast(result?.error ?? 'Failed to save project', 'error')
    }
  } catch (err) {
    console.error('projectActions: saveProject failed', err)
    showToast('Failed to save project', 'error')
  }
}

/**
 * Save As — neuen Speicherort wählen und Projekt dort speichern
 */
export async function saveProjectAs(): Promise<void> {
  const videoPath = getVideoPath()
  if (!videoPath) {
    showToast('No video loaded — nothing to save', 'warning')
    return
  }

  try {
    const dialogResult = await ipc.saveProjectDialog()
    if (!dialogResult?.success || !dialogResult.path) return

    const newPath = dialogResult.path
    const data = collectProjectData()

    const result = await ipc.saveProject(newPath, data)
    if (result?.success) {
      setProjectPath(newPath)
      setIsDirty(false)
      showToast('Project saved', 'success')
    } else {
      showToast(result?.error ?? 'Failed to save project', 'error')
    }
  } catch (err) {
    console.error('projectActions: saveProjectAs failed', err)
    showToast('Failed to save project', 'error')
  }
}

/**
 * Projekt öffnen — Verzeichnis wählen, project.json laden, State befüllen
 */
export async function openProject(): Promise<void> {
  // isDirty-Check — ungespeicherte Aenderungen abfragen
  if (getIsDirty()) {
    try {
      const confirmResult = await ipc.unsavedChangesDialog()
      if (!confirmResult?.success) return
      const response = confirmResult.response as unknown as string
      if (response === 'cancel') return
      if (response === 'save') {
        await saveProject()
      }
      // 'discard' → weiter ohne speichern
    } catch {
      return
    }
  }

  try {
    // Dialog: Projektordner wählen
    const dialogResult = await ipc.openProjectDialog()
    if (!dialogResult?.success || !dialogResult.path) return

    // Projekt laden via Main-Process
    const result = await ipc.openProject(dialogResult.path)
    if (!result?.success) {
      showToast(result?.error ?? 'Failed to open project', 'error')
      return
    }

    const data = result.data as Record<string, unknown> | undefined

    // Video stoppen + State zuruecksetzen
    callPauseAndReset()
    resetSelectionState()
    undoRedo.clear()

    // State aus Projektdaten befuellen (defensive Defaults)
    const scenes = (data?.scenes as unknown[]) ?? []
    setScenes(scenes as ReturnType<typeof getScenes>)
    setCollections((data?.collections as ReturnType<typeof getCollections>) ?? [])
    setFavoriteIndices((data?.favoriteIndices as number[]) ?? [])
    setDeletedIndices((data?.deletedIndices as number[]) ?? [])
    setThreshold((data?.threshold as number) ?? 0.3)
    setGridSize((data?.gridSize as number) ?? 200)
    setProjectPath(dialogResult.path)
    setCurrentShotIdx(-1)
    setIsDirty(false)

    // Video laden (falls vorhanden)
    const videoPath = data?.videoPath as string | undefined
    if (videoPath) {
      try {
        await openVideoFromPath(videoPath, { skipStateReset: true })
      } catch {
        showToast('Project loaded, but video file not found', 'warning')
      }
    }

    showToast('Project loaded', 'success')
  } catch (err) {
    console.error('projectActions: openProject failed', err)
    showToast('Failed to open project', 'error')
  }
}
