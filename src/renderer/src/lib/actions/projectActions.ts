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
import { registerPauseAndReset } from './videoActions'

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
    const data = {
      videoPath,
      scenes: getScenes(),
      favoriteIndices: getFavoriteIndices(),
      deletedIndices: getDeletedIndices(),
      collections: getCollections(),
      threshold: getThreshold(),
      gridSize: getGridSize(),
    }

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
 * Save As — TODO: Dialog implementieren
 */
export async function saveProjectAs(): Promise<void> {
  showToast('Save As — coming soon', 'info')
}

/**
 * Projekt öffnen — TODO: Dialog implementieren
 */
export async function openProject(): Promise<void> {
  showToast('Open Project — coming soon', 'info')
}
