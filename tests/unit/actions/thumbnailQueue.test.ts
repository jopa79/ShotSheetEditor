// thumbnailQueue.test.ts — Tests für QueuedExtractor
// Prüft: enqueue→Verarbeitung, getThumbPaths, Video-Switch-Guard, clear()

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { installFakeIpc, resetFakeIpc, mockExtractFrames } from '../../helpers/fakeIpc'
import {
  setVideoPath,
  setProjectPath,
  setIsDetecting,
  resetAllStores,
} from '@lib/stores'
import type { Scene } from '@shared/models'

// Hilfsfunktion: minimale Szene erstellen
function makeScene(index: number): Scene {
  return { index, startTime: index * 5, endTime: (index + 1) * 5, duration: 5 }
}

// Hilfsfunktion: async Batch vollständig durchlaufen lassen
// Drei Ticks: enqueue→#processQueue start, await ipc.extractFrames resolve, Post-await Code
async function flushAsync(ticks = 3): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

// Hilfsfunktion: Queue für Tests vorbereiten (Reihenfolge: Store → clear)
let thumbnailQueue: typeof import('@lib/actions/thumbnailQueue')

async function setupQueue(options: {
  videoPath?: string | null
  projectPath?: string | null
} = {}): Promise<void> {
  const videoPath = 'videoPath' in options ? options.videoPath : '/test/video.mp4'
  const projectPath = 'projectPath' in options ? options.projectPath : '/test/project'
  if (videoPath !== undefined) setVideoPath(videoPath)
  if (projectPath !== undefined) setProjectPath(projectPath)
  // clear() NACH setVideoPath damit #videoPath korrekt initialisiert wird
  thumbnailQueue.clear()
}

describe('thumbnailQueue (QueuedExtractor)', () => {
  beforeEach(async () => {
    installFakeIpc()
    resetAllStores()
    // Modul gecacht (Node ESM): Singleton bleibt, clear() resettet State
    thumbnailQueue = await import('@lib/actions/thumbnailQueue')
    // Standard-Setup: gültiger VideoPath + ProjectPath, dann clear()
    setVideoPath('/test/video.mp4')
    setProjectPath('/test/project')
    setIsDetecting(false)
    thumbnailQueue.clear()
  })

  afterEach(() => {
    resetFakeIpc()
    vi.clearAllMocks()
  })

  // ===== GRUPPE 1: Basis-Extraktion =====

  describe('enqueue + getThumbPaths', () => {
    it('verarbeitet eingequeute Szenen und befüllt thumbPathMap', async () => {
      const scenes = [makeScene(0), makeScene(1), makeScene(2)]
      thumbnailQueue.enqueue(scenes)

      await flushAsync()

      const paths = thumbnailQueue.getThumbPaths()
      expect(paths.size).toBe(3)
      expect(paths.get(0)).toMatch(/frame_0\.jpg/)
      expect(paths.get(1)).toMatch(/frame_1\.jpg/)
      expect(paths.get(2)).toMatch(/frame_2\.jpg/)
    })

    it('leere enqueue-Liste tut nichts', async () => {
      thumbnailQueue.enqueue([])
      await flushAsync()

      expect(thumbnailQueue.getThumbPaths().size).toBe(0)
    })

    it('mehrfaches enqueue akkumuliert Ergebnisse wenn Batch noch läuft', async () => {
      // Zwei Batches: erster startet sofort, zweiter wird angehängt
      thumbnailQueue.enqueue([makeScene(0)])
      thumbnailQueue.enqueue([makeScene(1)])

      await flushAsync(5)

      const paths = thumbnailQueue.getThumbPaths()
      // Mindestens Szene 0 muss verarbeitet worden sein
      expect(paths.has(0)).toBe(true)
    })

    it('Pfad enthält den outputDir-Prefix aus projectPath/thumbnails', async () => {
      setProjectPath('/my/project')
      thumbnailQueue.clear()
      // Nach clear() wieder richtig setzen damit #videoPath passt
      setVideoPath('/test/video.mp4')
      thumbnailQueue.clear()

      thumbnailQueue.enqueue([makeScene(0)])
      await flushAsync()

      const paths = thumbnailQueue.getThumbPaths()
      expect(paths.get(0)).toContain('/my/project/thumbnails')
    })
  })

  // ===== GRUPPE 2: Video-Switch-Guard (Race Condition) =====

  describe('Video-Switch-Guard', () => {
    it('veraltete Frames werden verworfen wenn videoPath NACH enqueue wechselt (async-Gap)', async () => {
      // IPC gibt erst zurück wenn der Test es erlaubt
      let resolveExtract!: () => void
      const blockSignal = new Promise<void>((resolve) => {
        resolveExtract = resolve
      })

      mockExtractFrames(async (_videoPath, scenes, outputDir) => {
        await blockSignal
        return {
          success: true,
          frames: scenes.map((s) => ({ index: s.index, path: `${outputDir}/frame_${s.index}.jpg` })),
        }
      })

      // Szenen einreihen mit altem Video — Batch startet, wartet auf blockSignal
      thumbnailQueue.enqueue([makeScene(0)])

      // Kurz warten damit der Batch den await erreicht
      await new Promise((resolve) => setTimeout(resolve, 0))

      // Video WECHSELN während Batch blockiert ist (Race-Condition)
      setVideoPath('/test/other-video.mp4')

      // Extraktion freigeben (zu spät — Video hat gewechselt)
      resolveExtract()

      await flushAsync()

      // Ergebnis muss verworfen worden sein weil videoPath != #videoPath
      expect(thumbnailQueue.getThumbPaths().size).toBe(0)
    })

    it('clear() mit neuem Video erlaubt korrekte Extraktion', async () => {
      // Neues Video konfigurieren und clear() aufrufen
      setVideoPath('/new/video.mp4')
      thumbnailQueue.clear()

      thumbnailQueue.enqueue([makeScene(0)])
      await flushAsync()

      // Frames mit neuem Video müssen durchkommen
      expect(thumbnailQueue.getThumbPaths().has(0)).toBe(true)
    })

    it('kein projectPath: Extraktion wird still übersprungen', async () => {
      // Kein projectPath → Queue kann kein outputDir bauen
      setVideoPath('/test/video.mp4')
      setProjectPath(null)
      thumbnailQueue.clear()

      thumbnailQueue.enqueue([makeScene(0)])
      await flushAsync()

      expect(thumbnailQueue.getThumbPaths().size).toBe(0)
    })

    it('kein videoPath: Extraktion wird still übersprungen', async () => {
      // Kein videoPath → #videoPath ist null, Switch-Guard blockiert
      setVideoPath(null)
      thumbnailQueue.clear()

      thumbnailQueue.enqueue([makeScene(0)])
      await flushAsync()

      expect(thumbnailQueue.getThumbPaths().size).toBe(0)
    })
  })

  // ===== GRUPPE 3: clear() =====

  describe('clear()', () => {
    it('leert thumbPathMap vollständig', async () => {
      thumbnailQueue.enqueue([makeScene(0), makeScene(1)])
      await flushAsync()

      expect(thumbnailQueue.getThumbPaths().size).toBeGreaterThan(0)

      thumbnailQueue.clear()
      expect(thumbnailQueue.getThumbPaths().size).toBe(0)
    })

    it('nach clear() können neue Frames eingereiht werden', async () => {
      thumbnailQueue.enqueue([makeScene(0)])
      await flushAsync()

      // Neues Video + clear() — simuliert Detection-Neustart
      setVideoPath('/test/video2.mp4')
      thumbnailQueue.clear()
      thumbnailQueue.enqueue([makeScene(5)])
      await flushAsync()

      const paths = thumbnailQueue.getThumbPaths()
      expect(paths.has(5)).toBe(true)
      expect(paths.has(0)).toBe(false)
    })
  })

  // ===== GRUPPE 4: Fehlerbehandlung =====

  describe('Fehlerbehandlung', () => {
    it('IPC-Fehler hinterlässt Queue in sauberem Zustand', async () => {
      // Ersten Batch mit Fehler werfen lassen
      mockExtractFrames(async () => {
        throw new Error('IPC-Fehler')
      })

      thumbnailQueue.enqueue([makeScene(0)])
      await flushAsync()

      // Kein Eintrag in thumbPathMap nach Fehler
      expect(thumbnailQueue.getThumbPaths().size).toBe(0)

      // Nach clear() + Reset kann neu extrahiert werden
      resetFakeIpc()
      installFakeIpc()
      setVideoPath('/test/video.mp4')
      thumbnailQueue.clear()

      thumbnailQueue.enqueue([makeScene(1)])
      await flushAsync()

      expect(thumbnailQueue.getThumbPaths().has(1)).toBe(true)
    })

    it('success: false in IPC-Response trägt keine Frames ein', async () => {
      mockExtractFrames(async () => ({ success: false, error: 'ffmpeg failed' }))

      thumbnailQueue.enqueue([makeScene(0)])
      await flushAsync()

      expect(thumbnailQueue.getThumbPaths().size).toBe(0)
    })
  })
})
