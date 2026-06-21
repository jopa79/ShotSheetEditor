// detectionOrchestrator.ts — Owner der Szenen-Liste-Writes waehrend einer Detection.
//
// Konsolidiert die frueher ueber App.svelte (progressive Append) und
// detectionActions.ts (finaler Merge) verstreute Logik in EIN Modul.
// Progressive Live-Anzeige bleibt erhalten (User sieht Szenen waehrend Detection).
//
// Scope-Hinweis (ehrlich): Der Orchestrator besitzt die SZENEN-LISTE-Writes
// waehrend Detection (Setup, progressive Append, finaler Merge). Das progressive
// Mergen einzelner Thumbnail-Pfade laeuft weiterhin getrennt
// (App.svelte registerExtractProgressHandler + QueuedExtractor) — das sind
// last-write-wins-Updates auf bestehende Szenen, keine Szenen-Erzeugung.
//
// Interface:
//   createDetectionOrchestrator(): DetectionOrchestrator
//   orchestrator.run(videoPath, threshold): Promise<DetectionResult>
//   orchestrator.cancel(): Promise<void>

import * as ipc from '../ipc/bridge'
import {
  getVideoPath,
  setScenes,
  getScenes,
  setIsDetecting,
  setDetectProgress,
  setDetectingSceneCount,
  setCurrentShotIdx,
  setIsDirty,
  setCollections,
  setActiveCollectionId,
  setFilterMode,
  setSelectedIndices,
  resetSelectionState,
} from '../stores'
import * as undoRedo from './undoRedo'
import * as thumbnailQueue from './thumbnailQueue'
import { showToast } from './toastManager'
import { registerDetectNewScenesHandler } from '../ipc/listeners'
import type { Scene } from '../../../../shared/models'

// --- Typen ---

export interface DetectionResult {
  success: boolean
  error?: string
  sceneCount?: number
}

export interface DetectionOrchestrator {
  /** Startet eine Detection-Session und verwaltet alle Szenen-Store-Writes. */
  run(videoPath: string, threshold: number): Promise<DetectionResult>
  /** Bricht die laufende Detection ab. */
  cancel(): Promise<void>
}

/**
 * Erstellt einen DetectionOrchestrator. Eine Instanz wird ueber mehrere run()-
 * Aufrufe wiederverwendet (detectionActions hält ein Singleton).
 */
export function createDetectionOrchestrator(): DetectionOrchestrator {
  // VideoPath zum Start des aktuellen Runs (Video-Switch-Guard)
  let startVideoPath: string | null = null
  // Monoton steigender Run-Zaehler — invalidiert ueberlappende/stale Runs.
  // Ein neuer run() oder cancel() macht aeltere Runs ungueltig (A→B→A, Doppelklick).
  let currentRun = 0
  // Cleanup-Funktion für den registrierten Detection-Callback
  let listenerCleanup: (() => void) | null = null

  /**
   * Gilt dieser Run noch? Invalidiert durch:
   *  - neuen run()/cancel() (currentRun erhoeht sich) → ueberlappende Runs
   *  - Video-Switch waehrend Detection → Ergebnisse gehoeren zum alten Video
   * Bekannte Grenze: A→B→A OHNE neuen run() passiert den Pfad-Check (Szenen
   * gehoeren zum dann wieder geladenen Video A) — bewusst akzeptiert.
   */
  function isRunValid(myRun: number): boolean {
    return myRun === currentRun && getVideoPath() === startVideoPath
  }

  /**
   * Stores auf Detection-Start-Zustand zuruecksetzen.
   * Entspricht dem frueheren Setup-Block in detectionActions.ts.
   */
  function resetStoresForDetection(): void {
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
  }

  /**
   * Progressive Szenen-Append — bei jedem onDetectProgress-Event.
   * Deduplikation: Der Main-Process (sceneDetector.ts) sendet via lastReportedCount
   * nur wirklich neue Szenen — daher reicht einfaches Append ohne Index-Pruefung.
   */
  function handleProgressAppend(myRun: number, newScenes: { index: number; startTime: number }[]): void {
    // Guard: stale Run (ueberlappend) oder Video-Switch → ignorieren
    if (!isRunValid(myRun)) return

    const current = getScenes()
    const asScenes: Scene[] = newScenes.map((s) => ({
      index: s.index,
      startTime: s.startTime,
      endTime: 0,
      duration: 0,
    }))

    // Progressiv in den Store schreiben — User sieht Szenen sofort
    setScenes([...current, ...asScenes])
    // Thumbnails in Queue einreihen (asynchron, im Hintergrund)
    thumbnailQueue.enqueue(asScenes)
  }

  /**
   * Finalen Merge nach ipc.detectScenes() durchfuehren: thumbPaths aus der Queue
   * in die finale Szenen-Liste (mit korrekter endTime/duration) einmergen.
   */
  function applyFinalMerge(finalScenes: Scene[]): void {
    const thumbPaths = thumbnailQueue.getThumbPaths()
    const scenesWithThumbs = finalScenes.map((scene) => {
      const tp = thumbPaths.get(scene.index)
      return tp ? { ...scene, thumbPath: tp } : scene
    })
    setScenes(scenesWithThumbs)
    setCurrentShotIdx(scenesWithThumbs.length > 0 ? 0 : -1)
  }

  /**
   * Detection-Callback registrieren (progressive Anzeige). Der Handler schliesst
   * ueber myRun, sodass ein stale Run nichts mehr in den Store schreibt.
   * Gibt eine Cleanup-Funktion zurueck, die den Handler de-registriert.
   */
  function wireDetectionCallback(myRun: number): () => void {
    registerDetectNewScenesHandler((newScenes) => handleProgressAppend(myRun, newScenes))
    return () => registerDetectNewScenesHandler(null)
  }

  return {
    async run(videoPath: string, threshold: number): Promise<DetectionResult> {
      const myRun = ++currentRun
      startVideoPath = videoPath

      // Phase 1: Setup
      resetStoresForDetection()
      // Phase 2: Detection-Callback verdrahten (progressive Anzeige)
      listenerCleanup = wireDetectionCallback(myRun)

      try {
        // Phase 3: Detection starten (blockiert bis ffmpeg fertig)
        const result = await ipc.detectScenes(videoPath, threshold)
        const scenes = result?.scenes ?? []

        // Guard: stale Run (ueberlappend) oder Video-Switch waehrend Detection
        if (!isRunValid(myRun)) {
          return { success: false, error: 'Video changed during detection' }
        }

        if (Array.isArray(scenes) && scenes.length > 0) {
          // Phase 4: Finaler Merge (thumbPaths aus Queue in Szenen einmergen)
          applyFinalMerge(scenes)
          setIsDirty(true)
          showToast(`Detected ${scenes.length} scenes`, 'success')
          return { success: true, sceneCount: scenes.length }
        }

        showToast('No scenes detected', 'warning')
        return { success: false, error: 'No scenes detected' }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Scene detection failed'
        console.error('detectionOrchestrator: run() fehlgeschlagen', err)
        showToast('Scene detection failed', 'error')
        return { success: false, error: message }
      } finally {
        // Cleanup nur wenn DIESER Run noch der aktive ist — sonst wuerde ein
        // stale Run den State/Handler eines neueren Runs zerstoeren.
        if (myRun === currentRun) {
          setIsDetecting(false)
          setDetectProgress(0)
          setDetectingSceneCount(0)
          listenerCleanup?.()
          listenerCleanup = null
        }
      }
    },

    async cancel(): Promise<void> {
      // Laufenden Run invalidieren (kein Store-Write mehr durch ihn).
      currentRun++
      // WICHTIG: Da der invalidierte Run sein finally-Cleanup ueberspringt
      // (myRun !== currentRun), muss cancel() den Detection-State SELBST
      // zuruecksetzen — sonst bliebe isDetecting fuer immer true.
      setIsDetecting(false)
      setDetectProgress(0)
      setDetectingSceneCount(0)
      listenerCleanup?.()
      listenerCleanup = null
      try {
        await ipc.cancelDetection()
      } catch (err) {
        console.error('detectionOrchestrator: cancel() fehlgeschlagen', err)
      }
    },
  }
}
