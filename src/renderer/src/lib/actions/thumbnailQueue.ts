// thumbnailQueue.ts — Queue-basierte progressive Thumbnail-Extraktion
// Kapselt Concurrency-Invariante in QueuedExtractor-Klasse mit privatem State:
// ein Batch gleichzeitig, progressives Mergen, Video-Switch-Guard

import type { Scene } from '../../../../shared/models'
import * as ipc from '../ipc/bridge'
import { getVideoPath, getProjectPath, getScenes, setScenes, getIsDetecting } from '../stores'

/**
 * Kapselt die Extractions-Queue mit privatem State.
 * Invarianten:
 *  - Immer nur ein Batch gleichzeitig (isProcessing-Flag)
 *  - Video-Switch wird erkannt: Frames für ein veraltetes Video werden verworfen
 *  - thumbPathMap wird progressiv befüllt und nie extern mutiert
 */
class QueuedExtractor {
  // Szenen die noch extrahiert werden müssen
  #queue: Scene[] = []

  // Gesammelte Ergebnisse (scene.index → thumbPath)
  #thumbPathMap = new Map<number, string>()

  // Flag ob gerade ein Batch läuft
  #isProcessing = false

  // videoPath zum Zeitpunkt des letzten clear() für Video-Switch-Guard
  #videoPath: string | null = null

  /**
   * Queue und Ergebnis-Map zurücksetzen.
   * Muss vor jeder neuen Detection aufgerufen werden.
   * Merkt sich den aktuellen videoPath als Referenz für den Switch-Guard.
   */
  clear(): void {
    this.#queue = []
    this.#thumbPathMap = new Map()
    this.#isProcessing = false
    this.#videoPath = getVideoPath()
  }

  /**
   * Neue Szenen einreihen und Queue-Verarbeitung starten falls nicht aktiv.
   */
  enqueue(scenes: Scene[]): void {
    if (!scenes || scenes.length === 0) return
    this.#queue.push(...scenes)
    if (!this.#isProcessing) {
      this.#processQueue()
    }
  }

  /**
   * Gesammelte thumbPath-Map zurückgeben (read-only Referenz).
   * Für Merge direkt nach Detection-Abschluss.
   */
  getThumbPaths(): Map<number, string> {
    return this.#thumbPathMap
  }

  /**
   * Nächsten Batch aus der Queue extrahieren (intern, rekursiv).
   * Enthält Video-Switch-Guard vor und nach dem await.
   */
  async #processQueue(): Promise<void> {
    if (this.#queue.length === 0) {
      this.#isProcessing = false
      // Falls Detection bereits beendet: thumbPaths in State mergen
      if (!getIsDetecting()) {
        this.#mergeThumbsIntoState()
      }
      return
    }

    this.#isProcessing = true

    // Video-Switch-Guard vor dem IPC-Aufruf
    const currentVideoPath = getVideoPath()
    if (currentVideoPath !== this.#videoPath) {
      this.#queue = []
      this.#isProcessing = false
      return
    }

    const projectPath = getProjectPath()
    if (!projectPath || !currentVideoPath) {
      this.#isProcessing = false
      return
    }

    // Alle wartenden Szenen als einen Batch nehmen
    const batch = this.#queue.splice(0, this.#queue.length)
    const outputDir = projectPath + '/thumbnails'

    try {
      const result = await ipc.extractFrames(currentVideoPath, batch, outputDir)

      // Video-Switch-Guard nach dem await (async-Gap)
      if (getVideoPath() !== this.#videoPath) {
        this.#queue = []
        this.#isProcessing = false
        return
      }

      // Ergebnisse in Map eintragen
      const frames = (result as { frames?: { path?: string; index?: number }[] })?.frames
      if (result?.success && frames) {
        for (const frame of frames) {
          if (frame?.path != null && frame?.index != null) {
            this.#thumbPathMap.set(frame.index, frame.path)
          }
        }
      }
    } catch (err) {
      console.error('thumbnailQueue: Extraktion fehlgeschlagen', err)
    }

    this.#isProcessing = false

    if (this.#queue.length > 0) {
      this.#processQueue()
    } else if (!getIsDetecting()) {
      this.#mergeThumbsIntoState()
    }
  }

  /**
   * Noch nicht im State enthaltene thumbPaths nachträglich einmergen.
   */
  #mergeThumbsIntoState(): void {
    if (this.#thumbPathMap.size === 0) return
    const scenes = getScenes()
    if (scenes.length === 0) return

    let changed = false
    const newScenes = scenes.map((scene) => {
      const tp = this.#thumbPathMap.get(scene.index)
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
}

// Singleton-Instanz — Konsumenten nutzen die exportierten Funktionen
const extractor = new QueuedExtractor()

// Öffentliches Interface — identisch zu den bisherigen Exports
// damit bestehende Konsumenten (detectionActions, listeners) ohne Änderung bleiben

/**
 * Queue und Ergebnis-Map zurücksetzen.
 * Muss vor jeder neuen Detection aufgerufen werden.
 */
export function clear(): void {
  extractor.clear()
}

/**
 * Neue Szenen einreihen und Queue-Verarbeitung starten.
 */
export function enqueue(scenes: Scene[]): void {
  extractor.enqueue(scenes)
}

/**
 * Gesammelte thumbPath-Map zurückgeben.
 * Für Merge direkt nach Detection-Abschluss.
 */
export function getThumbPaths(): Map<number, string> {
  return extractor.getThumbPaths()
}
