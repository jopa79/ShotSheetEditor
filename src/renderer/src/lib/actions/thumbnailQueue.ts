// thumbnailQueue.ts — Queue-basierte progressive Thumbnail-Extraktion
// Ersetzt V1 thumbnailQueue.js (144 LOC)
// Reiht Szenen zur Thumbnail-Extraktion ein — ein Batch gleichzeitig

import type { Scene } from '../../../../shared/models'
import * as ipc from '../ipc/bridge'
import { getVideoPath, getProjectPath, getScenes, setScenes, getIsDetecting } from '../stores'

/** Szenen die noch extrahiert werden müssen */
let queue: Scene[] = []

/** Gesammelte Ergebnisse (scene.index → thumbPath) */
let thumbPathMap = new Map<number, string>()

/** Flag ob gerade ein Batch läuft */
let isProcessing = false

/** videoPath zum Zeitpunkt des letzten clear() für Race-Condition-Schutz */
let currentVideoPath: string | null = null

/**
 * Queue und Ergebnis-Map zurücksetzen.
 * Muss vor jeder neuen Detection aufgerufen werden.
 */
export function clear(): void {
  queue = []
  thumbPathMap = new Map()
  isProcessing = false
  currentVideoPath = getVideoPath()
}

/**
 * Neue Szenen einreihen und Queue-Verarbeitung starten.
 */
export function enqueue(scenes: Scene[]): void {
  if (!scenes || scenes.length === 0) return
  queue.push(...scenes)
  if (!isProcessing) {
    processQueue()
  }
}

/**
 * Gesammelte thumbPath-Map zurückgeben.
 * Für Merge direkt nach Detection-Abschluss.
 */
export function getThumbPaths(): Map<number, string> {
  return thumbPathMap
}

/**
 * Nächsten Batch aus der Queue extrahieren (intern, rekursiv).
 */
async function processQueue(): Promise<void> {
  if (queue.length === 0) {
    isProcessing = false
    // Falls Detection bereits beendet: thumbPaths in State mergen
    if (!getIsDetecting()) {
      mergeThumbsIntoState()
    }
    return
  }

  isProcessing = true

  // Race-Condition-Schutz
  const videoPath = getVideoPath()
  if (videoPath !== currentVideoPath) {
    queue = []
    isProcessing = false
    return
  }

  const projectPath = getProjectPath()
  if (!projectPath || !videoPath) {
    isProcessing = false
    return
  }

  // Alle wartenden Szenen als einen Batch nehmen
  const batch = queue.splice(0, queue.length)
  const outputDir = projectPath + '/thumbnails'

  try {
    const result = await ipc.extractFrames(videoPath, batch, outputDir)

    // Race-Condition-Schutz nach await
    if (getVideoPath() !== currentVideoPath) {
      queue = []
      isProcessing = false
      return
    }

    // Ergebnisse in Map eintragen
    const frames = (result as { frames?: { path?: string; index?: number }[] })?.frames
    if (result?.success && frames) {
      for (const frame of frames) {
        if (frame?.path != null && frame?.index != null) {
          thumbPathMap.set(frame.index, frame.path)
        }
      }
    }
  } catch (err) {
    console.error('thumbnailQueue: Extraktion fehlgeschlagen', err)
  }

  isProcessing = false

  if (queue.length > 0) {
    processQueue()
  } else if (!getIsDetecting()) {
    mergeThumbsIntoState()
  }
}

/**
 * Noch nicht im State enthaltene thumbPaths nachträglich einmergen.
 */
function mergeThumbsIntoState(): void {
  if (thumbPathMap.size === 0) return
  const scenes = getScenes()
  if (scenes.length === 0) return

  let changed = false
  const newScenes = scenes.map((scene) => {
    const tp = thumbPathMap.get(scene.index)
    if (tp && scene.thumbPath !== tp) {
      changed = true
      return { ...scene, thumbPath: tp }
    }
    return scene
  })

  if (changed) {
    setScenes(newScenes)
  }
}
