// detectionActions.ts — Scene-Detection-Aktionen
// Ersetzt Detection-Logik aus V1 toolbar.js

import * as ipc from '../ipc/bridge'
import {
  getVideoPath,
  getThreshold,
  setScenes,
  setCurrentShotIdx,
  setIsDirty,
  setIsDetecting,
  setDetectProgress,
  setDetectingSceneCount,
} from '../stores'
import { resetSelectionState, setSelectedIndices } from '../stores'
import * as undoRedo from './undoRedo'
import { showToast } from './toastManager'
import * as thumbnailQueue from './thumbnailQueue'
import { setCollections, setActiveCollectionId, setFilterMode } from '../stores'

/**
 * Scene Detection starten
 */
export async function detectScenes(): Promise<void> {
  const videoPath = getVideoPath()
  if (!videoPath) {
    showToast('No video loaded', 'warning')
    return
  }

  const threshold = getThreshold()

  try {
    // Szenen und Selektionen leeren — Grid zeigt sofort Empty State
    setIsDetecting(true)
    setDetectProgress(0)
    setDetectingSceneCount(0)
    setScenes([])
    setSelectedIndices([])
    resetSelectionState()
    setCollections([])
    setActiveCollectionId(null)
    setFilterMode('all')
    setCurrentShotIdx(-1)
    undoRedo.clear()
    thumbnailQueue.clear()

    const result = await ipc.detectScenes(videoPath, threshold)
    const scenes = result?.scenes ?? []

    if (Array.isArray(scenes) && scenes.length > 0) {
      // Bereits extrahierte thumbPaths aus Queue in Szenen mergen
      const thumbPaths = thumbnailQueue.getThumbPaths()
      const scenesWithThumbs = scenes.map((scene) => {
        const tp = thumbPaths.get(scene.index)
        return tp ? { ...scene, thumbPath: tp } : scene
      })

      setScenes(scenesWithThumbs)
      setCurrentShotIdx(scenesWithThumbs.length > 0 ? 0 : -1)
      setIsDirty(true)
      showToast(`Detected ${scenes.length} scenes`, 'success')
    } else {
      showToast('No scenes detected', 'warning')
    }
  } catch (err) {
    console.error('detectionActions: detectScenes failed', err)
    showToast('Scene detection failed', 'error')
  } finally {
    setIsDetecting(false)
    setDetectProgress(0)
    setDetectingSceneCount(0)
  }
}

/**
 * Laufende Detection abbrechen
 */
export async function cancelDetection(): Promise<void> {
  try {
    await ipc.cancelDetection()
  } catch (err) {
    console.error('detectionActions: cancelDetection failed', err)
  }
}
