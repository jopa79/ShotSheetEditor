// fakeIpc.ts — Test-Seam für window.electronAPI
//
// Setzt globalThis.window.electronAPI auf einen In-Memory-Fake,
// damit Action-Module (videoActions, detectionActions, exportActions,
// thumbnailQueue) ohne echtes Electron getestet werden können.
//
// Entscheidung D4: bridge.ts bleibt unangetastet (reines Pass-through).
// Der Seam liegt im window-Objekt, das bridge.ts lazy liest.
//
// Nutzung im Test:
//   beforeEach(() => installFakeIpc())           // Default-Antworten
//   installFakeIpc({ exportZip: vi.fn()... })    // Mit Overrides (überschreibt Default)
//   afterEach(() => resetFakeIpc())

import { vi } from 'vitest'
import type { ElectronAPI, CleanupFn } from '../../src/preload/types'
import type { Scene } from '../../src/shared/models'

// ---------------------------------------------------------------------------
// Stateful extractFrames-Mock — von QueuedExtractor-Tests genutzt.
// Default: liefert pro Szene einen Frame-Pfad <outputDir>/frame_<index>.jpg.
// Pro Test via mockExtractFrames() überschreibbar; resetFakeIpc() setzt zurück.
// ---------------------------------------------------------------------------
type ExtractFramesImpl = (
  videoPath: string,
  scenes: Scene[],
  outputDir: string,
) => Promise<{ success: boolean; error?: string; frames?: { index: number; path: string }[] }>

const _defaultExtractFrames: ExtractFramesImpl = async (_videoPath, scenes, outputDir) => ({
  success: true,
  frames: scenes.map((s) => ({ index: s.index, path: `${outputDir}/frame_${s.index}.jpg` })),
})

let _extractFramesMock: ExtractFramesImpl = _defaultExtractFrames

/** Ersetzt die extractFrames-Implementierung für einen Test (z.B. QueuedExtractor). */
export function mockExtractFrames(impl: ExtractFramesImpl): void {
  _extractFramesMock = impl
}

// ---------------------------------------------------------------------------
// Genutzte Teilmenge von ElectronAPI — nur was bridge.ts tatsächlich aufruft.
// Neue Methoden hier ergänzen wenn weitere Action-Module getestet werden.
// ---------------------------------------------------------------------------

/** Listener-Callbacks die der Fake registriert hat — für Event-Emission in Tests */
export interface FakeIpcListeners {
  onDetectProgress: ((progress: unknown) => void)[]
  onExtractProgress: ((data: unknown) => void)[]
  onProxyProgress: ((progress: unknown) => void)[]
  onExportProgress: ((progress: unknown) => void)[]
  onThemeChanged: ((theme: string) => void)[]
  onMenuAction: ((action: unknown) => void)[]
  onBeforeQuit: (() => void)[]
}

/** Aktuell registrierte Listener (zum Event-Feuern in Tests) */
let _listeners: FakeIpcListeners = {
  onDetectProgress: [],
  onExtractProgress: [],
  onProxyProgress: [],
  onExportProgress: [],
  onThemeChanged: [],
  onMenuAction: [],
  onBeforeQuit: [],
}

// Hilfsfunktion: Cleanup-Factory für einen Listener-Slot
function makeListenerFn<T extends (...args: unknown[]) => void>(
  slot: (keyof FakeIpcListeners)
): (cb: T) => CleanupFn {
  return (cb: T): CleanupFn => {
    ;(_listeners[slot] as unknown as T[]).push(cb)
    // Cleanup entfernt nur diese eine Referenz
    return () => {
      const arr = _listeners[slot] as unknown as T[]
      const idx = arr.indexOf(cb)
      if (idx !== -1) arr.splice(idx, 1)
    }
  }
}

// ---------------------------------------------------------------------------
// Standard-Default-Antworten — sinnvolle Werte die keinen Fehler auslösen
// ---------------------------------------------------------------------------

function buildDefaultApi(): ElectronAPI {
  return {
    // --- Invoke: Renderer → Main ---
    openVideo: vi.fn().mockResolvedValue({ success: true, path: '/fake/video.mp4' }),
    getVideoMeta: vi.fn().mockResolvedValue({ success: true, data: { codec: 'h264', width: 1920, height: 1080, duration: 60, fps: 25, size: 5000, format: 'mp4', needsProxy: false } }),

    detectScenes: vi.fn().mockResolvedValue({ success: true, scenes: [] }),
    cancelDetection: vi.fn().mockResolvedValue({ success: true }),

    extractFrames: vi.fn((videoPath: string, scenes: Scene[], outputDir: string) =>
      _extractFramesMock(videoPath, scenes, outputDir),
    ),
    getThumb: vi.fn().mockResolvedValue({ success: true, data: 'data:image/jpeg;base64,fake' }),

    newProject: vi.fn().mockResolvedValue({ success: true, path: '/fake/project' }),
    openProject: vi.fn().mockResolvedValue({ success: true, data: {} }),
    saveProject: vi.fn().mockResolvedValue({ success: true }),

    exportSequence: vi.fn().mockResolvedValue({ success: true }),
    exportZip: vi.fn().mockResolvedValue({ success: true }),
    selectExportDir: vi.fn().mockResolvedValue({ success: true, path: '/fake/output' }),

    exportClips: vi.fn().mockResolvedValue({ success: true, exportedClips: [] }),
    cancelClipExport: vi.fn().mockResolvedValue({ success: true }),
    onClipExportProgress: (): CleanupFn => () => {},

    extractAudio: vi.fn().mockResolvedValue({ success: true, audioPath: '/fake/audio.wav' }),
    generateWaveform: vi.fn().mockResolvedValue({
      success: true,
      data: { peaks: [], sampleRate: 16000, duration: 0 },
    }),

    startTranscription: vi.fn().mockResolvedValue({ success: true, segments: [] }),
    cancelTranscription: vi.fn().mockResolvedValue({ success: true }),
    onTranscriptionProgress: (): CleanupFn => () => {},

    setApiKey: vi.fn().mockResolvedValue({ success: true }),
    getApiKey: vi.fn().mockResolvedValue({ success: true, key: undefined }),
    hasApiKey: vi.fn().mockResolvedValue({ success: true, hasKey: false }),
    deleteApiKey: vi.fn().mockResolvedValue({ success: true }),

    toggleTheme: vi.fn().mockResolvedValue({ success: true, theme: 'dark' }),
    getTheme: vi.fn().mockResolvedValue({ success: true, theme: 'dark' }),

    getVersion: vi.fn().mockResolvedValue({ success: true, version: '2.0.0-test' }),
    confirmQuit: vi.fn().mockResolvedValue(undefined),

    generateProxy: vi.fn().mockResolvedValue({ success: true, proxyPath: '/fake/proxy.mp4' }),
    cancelProxy: vi.fn().mockResolvedValue({ success: true }),

    openVideoDialog: vi.fn().mockResolvedValue({ success: true, path: '/fake/video.mp4' }),
    openProjectDialog: vi.fn().mockResolvedValue({ success: true, path: '/fake/project' }),
    saveProjectDialog: vi.fn().mockResolvedValue({ success: true, path: '/fake/project.json' }),
    unsavedChangesDialog: vi.fn().mockResolvedValue({ success: true, response: 'discard' }),

    // --- Listener: Main → Renderer ---
    onDetectProgress: makeListenerFn('onDetectProgress'),
    onExtractProgress: makeListenerFn('onExtractProgress'),
    onProxyProgress: makeListenerFn('onProxyProgress'),
    onExportProgress: makeListenerFn('onExportProgress'),
    onThemeChanged: makeListenerFn('onThemeChanged'),
    onMenuAction: makeListenerFn('onMenuAction'),
    onBeforeQuit: makeListenerFn('onBeforeQuit'),
  }
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

/**
 * Setzt globalThis.window.electronAPI auf den Fake.
 * Overrides überschreiben die jeweiligen Default-vi.fn()-Mocks.
 * Darf mehrfach aufgerufen werden — ersetzt das vorherige window-Objekt.
 */
export function installFakeIpc(overrides: Partial<ElectronAPI> = {}): void {
  const api: ElectronAPI = {
    ...buildDefaultApi(),
    ...overrides,
  }
  ;(globalThis as Record<string, unknown>).window = { electronAPI: api }
}

/**
 * Entfernt globalThis.window nach dem Test.
 * In afterEach aufrufen.
 */
export function resetFakeIpc(): void {
  delete (globalThis as Record<string, unknown>).window
  // extractFrames-Mock auf Default zurücksetzen
  _extractFramesMock = _defaultExtractFrames
  // Listener-Slots zurücksetzen
  _listeners = {
    onDetectProgress: [],
    onExtractProgress: [],
    onProxyProgress: [],
    onExportProgress: [],
    onThemeChanged: [],
    onMenuAction: [],
    onBeforeQuit: [],
  }
}

/**
 * Feuert einen Event an alle registrierten Listener eines Slots.
 * Hilfreich um IPC-Push-Events (z.B. Progress) in Tests zu simulieren.
 *
 * Beispiel:
 *   emitFakeEvent('onDetectProgress', { progress: 0.5, scenesDetected: 3, newScenes: [] })
 */
export function emitFakeEvent<K extends keyof FakeIpcListeners>(
  slot: K,
  ...args: Parameters<FakeIpcListeners[K][number]>
): void {
  const callbacks = _listeners[slot] as ((...a: unknown[]) => void)[]
  for (const cb of callbacks) {
    cb(...(args as unknown[]))
  }
}
