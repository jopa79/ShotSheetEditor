// detectionActions.ts — Scene-Detection-Aktionen (schlanke Fassade)
// Delegiert an DetectionOrchestrator — der einzige Owner der Detection-Store-Writes.
// Ersetzt Detection-Logik aus V1 toolbar.js

import { getVideoPath, getThreshold } from '../stores'
import { showToast } from './toastManager'
import { createDetectionOrchestrator } from './detectionOrchestrator'

// Singleton-Orchestrator für die gesamte App-Session.
// Wird bei jedem run()-Aufruf mit dem aktuellen videoPath neu initialisiert.
const _orchestrator = createDetectionOrchestrator()

/**
 * Scene Detection starten.
 * Delegiert vollständig an DetectionOrchestrator.run() —
 * progressive Szenen-Anzeige, Thumbnail-Queue und finaler Merge
 * sind dort gebündelt.
 */
export async function detectScenes(): Promise<void> {
  const videoPath = getVideoPath()
  if (!videoPath) {
    showToast('No video loaded', 'warning')
    return
  }

  const threshold = getThreshold()
  await _orchestrator.run(videoPath, threshold)
}

/**
 * Laufende Detection abbrechen.
 */
export async function cancelDetection(): Promise<void> {
  await _orchestrator.cancel()
}
