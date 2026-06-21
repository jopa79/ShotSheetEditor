// listeners.ts — IPC-Event-Listener Setup
// Wird in App.svelte per $effect aufgerufen
// Listener-Cleanup passiert automatisch via $effect Destruktor
// Ersetzt V1 app.js _setupIpcListeners()

import type { CleanupFn } from './bridge'
import * as ipc from './bridge'
import {
  setTranscodeProgress,
  setDetectProgress,
  setDetectingSceneCount,
  setIsDetecting,
  setIsTranscoding,
  getIsDirty,
} from '../stores'

// --- Callback-Registrierung ---
// Werden von App.svelte gesetzt, damit Feature-Components
// auf IPC-Events reagieren können ohne zirkuläre Imports

type ExtractProgressCallback = (data: { frameResult?: { index: number; path: string } }) => void
type DetectNewScenesCallback = (newScenes: { index: number; startTime: number }[]) => void

let _onExtractProgress: ExtractProgressCallback | null = null
let _onDetectNewScenes: DetectNewScenesCallback | null = null

/** Callback für Extract-Progress registrieren (ShotGrid.updateThumbnail) */
export function registerExtractProgressHandler(cb: ExtractProgressCallback): void {
  _onExtractProgress = cb
}

/**
 * Callback für neue Szenen während Detection (DetectionOrchestrator).
 * `null` de-registriert den Handler (vom Orchestrator beim Run-Ende genutzt).
 */
export function registerDetectNewScenesHandler(cb: DetectNewScenesCallback | null): void {
  _onDetectNewScenes = cb
}

/**
 * Alle IPC-Listener aufsetzen.
 * Gibt eine Cleanup-Funktion zurück die alle Listener entfernt.
 * Aufruf: in App.svelte per $effect(() => { return setupIpcListeners() })
 */
export function setupIpcListeners(): CleanupFn {
  const cleanups: CleanupFn[] = []

  // Proxy-Progress
  cleanups.push(
    ipc.onProxyProgress((progress) => {
      setTranscodeProgress(progress.progress ?? 0)
    })
  )

  // Detection-Progress — neue Szenen progressiv
  cleanups.push(
    ipc.onDetectProgress((progress) => {
      setDetectProgress(progress.progress ?? 0)
      setDetectingSceneCount(progress.scenesDetected ?? 0)

      // Neu erkannte Szenen weiterleiten
      if (progress.newScenes && progress.newScenes.length > 0 && _onDetectNewScenes) {
        _onDetectNewScenes(progress.newScenes)
      }
    })
  )

  // Extract-Progress — einzelne Thumbnails
  cleanups.push(
    ipc.onExtractProgress((data) => {
      if ((data as { frameResult?: unknown }).frameResult && _onExtractProgress) {
        _onExtractProgress(data as { frameResult: { index: number; path: string } })
      }
    })
  )

  // Theme-Changed
  cleanups.push(
    ipc.onThemeChanged((theme) => {
      document.documentElement.classList.toggle('light-theme', theme === 'light')
    })
  )

  // Before-Quit
  cleanups.push(
    ipc.onBeforeQuit(async () => {
      if (getIsDirty()) {
        const confirmed = confirm('You have unsaved changes. Are you sure you want to quit?')
        if (!confirmed) return
      }
      await ipc.confirmQuit()
    })
  )

  // Cleanup-Funktion: entfernt alle Listener auf einmal
  return () => {
    for (const cleanup of cleanups) {
      cleanup()
    }
    _onExtractProgress = null
    _onDetectNewScenes = null
  }
}
