// detectionOrchestrator.test.ts — Tests fuer den DetectionOrchestrator (#4).
//
// Prueft das deepened Modul: progressive Live-Anzeige bleibt erhalten,
// keine Doppel-Szenen, finaler thumbnail-Merge, Video-Switch-Race-Guard,
// cancel(), isDetecting-Lifecycle, leere/fehlerhafte Antworten.
//
// Nutzt den committeten fakeIpc-Seam: installFakeIpc({overrides}) fuer
// detectScenes/cancelDetection, emitFakeEvent('onDetectProgress', ...) fuer
// progressive Events, mockExtractFrames(impl) fuer die Thumbnail-Queue.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { installFakeIpc, resetFakeIpc, emitFakeEvent, mockExtractFrames } from '../../helpers/fakeIpc'
import {
  getScenes,
  setVideoPath,
  setProjectPath,
  getIsDetecting,
  resetAllStores,
} from '@lib/stores'
import type { Scene } from '@shared/models'

function makeScene(index: number, startTime: number): Scene {
  return { index, startTime, endTime: startTime + 5, duration: 5 }
}

function makeProgressEvent(
  newScenes: { index: number; startTime: number }[],
  scenesDetected: number,
) {
  return {
    progress: scenesDetected / 10,
    processedTime: scenesDetected * 5,
    totalDuration: 100,
    scenesDetected,
    newScenes,
  }
}

describe('DetectionOrchestrator', () => {
  let listenerCleanup: (() => void) | undefined

  beforeEach(() => {
    resetAllStores()
    setVideoPath('/test/video.mp4')
    setProjectPath('/test/project')
  })

  afterEach(() => {
    listenerCleanup?.()
    listenerCleanup = undefined
    resetFakeIpc()
    vi.restoreAllMocks()
  })

  // Installiert die Fake-IPC mit detect/cancel-Overrides und aktiviert das
  // onDetectProgress-Routing (setupIpcListeners() = App-Lifecycle-Aequivalent).
  async function setup(opts: {
    detectScenes: ReturnType<typeof vi.fn>
    cancelDetection?: ReturnType<typeof vi.fn>
  }): Promise<void> {
    installFakeIpc({
      detectScenes: opts.detectScenes,
      cancelDetection: opts.cancelDetection ?? vi.fn().mockResolvedValue({ success: true }),
    })
    const { setupIpcListeners } = await import('@lib/ipc/listeners')
    listenerCleanup = setupIpcListeners()
  }

  it('O1: progressive Szenen sind bereits waehrend run() im Store sichtbar', async () => {
    let resolveDetect!: (v: { success: boolean; scenes: Scene[] }) => void
    const detectScenes = vi.fn(
      () => new Promise<{ success: boolean; scenes: Scene[] }>((r) => { resolveDetect = r }),
    )
    await setup({ detectScenes })
    mockExtractFrames(async () => ({ success: true, frames: [] }))

    const { createDetectionOrchestrator } = await import('@lib/actions/detectionOrchestrator')
    const orchestrator = createDetectionOrchestrator()
    const runPromise = orchestrator.run('/test/video.mp4', 0.4)

    // Progress-Event feuern waehrend run() noch awaitet
    emitFakeEvent('onDetectProgress', makeProgressEvent(
      [{ index: 0, startTime: 0 }, { index: 1, startTime: 5 }],
      2,
    ))

    // SOFORT sichtbar (progressive Anzeige erhalten)
    expect(getScenes()).toHaveLength(2)
    expect(getScenes()[0].index).toBe(0)

    resolveDetect({ success: true, scenes: [makeScene(0, 0), makeScene(1, 5)] })
    await runPromise
    expect(getScenes().length).toBeGreaterThanOrEqual(2)
  })

  it('O2: mehrere disjunkte Progress-Events erzeugen keine Duplikate', async () => {
    const detectScenes = vi.fn().mockResolvedValue({
      success: true,
      scenes: [makeScene(0, 0), makeScene(1, 5), makeScene(2, 10), makeScene(3, 15), makeScene(4, 20)],
    })
    await setup({ detectScenes })
    mockExtractFrames(async () => ({ success: true, frames: [] }))

    const { createDetectionOrchestrator } = await import('@lib/actions/detectionOrchestrator')
    const orchestrator = createDetectionOrchestrator()
    const runPromise = orchestrator.run('/test/video.mp4', 0.4)

    emitFakeEvent('onDetectProgress', makeProgressEvent(
      [{ index: 0, startTime: 0 }, { index: 1, startTime: 5 }, { index: 2, startTime: 10 }], 3,
    ))
    emitFakeEvent('onDetectProgress', makeProgressEvent(
      [{ index: 3, startTime: 15 }, { index: 4, startTime: 20 }], 5,
    ))

    await runPromise
    const indices = getScenes().map((s) => s.index)
    expect(new Set(indices).size).toBe(indices.length)
  })

  it('O3: nach run() haben Szenen ihre thumbPaths aus der Queue', async () => {
    const detectScenes = vi.fn().mockResolvedValue({
      success: true,
      scenes: [makeScene(0, 0), makeScene(1, 5), makeScene(2, 10)],
    })
    await setup({ detectScenes })
    mockExtractFrames(async (_v, scenes, outputDir) => ({
      success: true,
      frames: scenes.map((s) => ({ index: s.index, path: `${outputDir}/frame_${s.index}.jpg` })),
    }))

    const { createDetectionOrchestrator } = await import('@lib/actions/detectionOrchestrator')
    const orchestrator = createDetectionOrchestrator()
    const runPromise = orchestrator.run('/test/video.mp4', 0.4)

    emitFakeEvent('onDetectProgress', makeProgressEvent(
      [{ index: 0, startTime: 0 }, { index: 1, startTime: 5 }, { index: 2, startTime: 10 }], 3,
    ))
    // Queue asynchron verarbeiten lassen
    await new Promise((r) => setTimeout(r, 0))

    const result = await runPromise
    expect(result.success).toBe(true)
    expect(getScenes()).toHaveLength(3)
    expect(getScenes().filter((s) => s.thumbPath != null).length).toBeGreaterThan(0)
  })

  it('O4: Video-Switch waehrend run() laesst keine Szenen des alten Videos im Store', async () => {
    const detectScenes = vi.fn().mockResolvedValue({
      success: true,
      scenes: [makeScene(0, 0), makeScene(1, 5)],
    })
    await setup({ detectScenes })
    mockExtractFrames(async () => ({ success: true, frames: [] }))

    const { createDetectionOrchestrator } = await import('@lib/actions/detectionOrchestrator')
    const orchestrator = createDetectionOrchestrator()
    const runPromise = orchestrator.run('/test/video.mp4', 0.4)

    // Video wechselt waehrend Detection laeuft → Race-Guard greift
    setVideoPath('/test/other-video.mp4')

    const result = await runPromise
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/changed/i)
    // Kein finaler Merge des alten Videos
    expect(getScenes()).toHaveLength(0)
  })

  it('O5: cancel() ruft ipc.cancelDetection() auf', async () => {
    const cancelDetection = vi.fn().mockResolvedValue({ success: true })
    const detectScenes = vi.fn(() => new Promise<{ success: boolean; scenes: Scene[] }>(() => {}))
    await setup({ detectScenes, cancelDetection })

    const { createDetectionOrchestrator } = await import('@lib/actions/detectionOrchestrator')
    const orchestrator = createDetectionOrchestrator()
    void orchestrator.run('/test/video.mp4', 0.4)

    await orchestrator.cancel()
    expect(cancelDetection).toHaveBeenCalledOnce()
  })

  it('O6: isDetecting ist true waehrend run() und false danach', async () => {
    let detectingDuringRun = false
    const detectScenes = vi.fn(async () => {
      detectingDuringRun = getIsDetecting()
      return { success: true, scenes: [] }
    })
    await setup({ detectScenes })
    mockExtractFrames(async () => ({ success: true, frames: [] }))

    const { createDetectionOrchestrator } = await import('@lib/actions/detectionOrchestrator')
    const orchestrator = createDetectionOrchestrator()
    await orchestrator.run('/test/video.mp4', 0.4)

    expect(detectingDuringRun).toBe(true)
    expect(getIsDetecting()).toBe(false)
  })

  it('O7: leere Szenen-Antwort → success:false und leerer Store', async () => {
    const detectScenes = vi.fn().mockResolvedValue({ success: true, scenes: [] })
    await setup({ detectScenes })
    mockExtractFrames(async () => ({ success: true, frames: [] }))

    const { createDetectionOrchestrator } = await import('@lib/actions/detectionOrchestrator')
    const orchestrator = createDetectionOrchestrator()
    const result = await orchestrator.run('/test/video.mp4', 0.4)

    expect(result.success).toBe(false)
    expect(getScenes()).toHaveLength(0)
  })

  it('O8: IPC-Fehler → success:false, Fehlertext, isDetecting=false danach', async () => {
    const detectScenes = vi.fn().mockRejectedValue(new Error('ffmpeg crash'))
    await setup({ detectScenes })

    const { createDetectionOrchestrator } = await import('@lib/actions/detectionOrchestrator')
    const orchestrator = createDetectionOrchestrator()
    const result = await orchestrator.run('/test/video.mp4', 0.4)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(getIsDetecting()).toBe(false)
  })

  it('O9: ueberlappende Runs — der stale Run schreibt nicht (Run-Token)', async () => {
    // Run A haengt; Run B (selbe Instanz) startet danach und gewinnt.
    let resolveA!: (v: { success: boolean; scenes: Scene[] }) => void
    const detectA = vi.fn(() => new Promise<{ success: boolean; scenes: Scene[] }>((r) => { resolveA = r }))
    await setup({ detectScenes: detectA })
    mockExtractFrames(async () => ({ success: true, frames: [] }))

    const { createDetectionOrchestrator } = await import('@lib/actions/detectionOrchestrator')
    const orchestrator = createDetectionOrchestrator()
    const runA = orchestrator.run('/test/video.mp4', 0.4) // haengt

    // Run B auf derselben Instanz → currentRun erhoeht sich, A wird stale
    const detectB = vi.fn().mockResolvedValue({ success: true, scenes: [makeScene(7, 35)] })
    installFakeIpc({ detectScenes: detectB, cancelDetection: vi.fn().mockResolvedValue({ success: true }) })
    const resB = await orchestrator.run('/test/video.mp4', 0.4)
    expect(resB.success).toBe(true)
    expect(getScenes().map((s) => s.index)).toEqual([7])

    // A loest verspaetet auf — darf B's Ergebnis NICHT ueberschreiben
    resolveA({ success: true, scenes: [makeScene(0, 0), makeScene(1, 5)] })
    const resA = await runA
    expect(resA.success).toBe(false)
    expect(getScenes().map((s) => s.index)).toEqual([7])
  })

  it('O10: cancel() setzt isDetecting zurueck — auch wenn der Run noch haengt', async () => {
    let resolveDetect!: (v: { success: boolean; scenes: Scene[] }) => void
    const detectScenes = vi.fn(() => new Promise<{ success: boolean; scenes: Scene[] }>((r) => { resolveDetect = r }))
    const cancelDetection = vi.fn().mockResolvedValue({ success: true })
    await setup({ detectScenes, cancelDetection })
    mockExtractFrames(async () => ({ success: true, frames: [] }))

    const { createDetectionOrchestrator } = await import('@lib/actions/detectionOrchestrator')
    const orchestrator = createDetectionOrchestrator()
    const runPromise = orchestrator.run('/test/video.mp4', 0.4)
    expect(getIsDetecting()).toBe(true) // laeuft

    await orchestrator.cancel()
    expect(cancelDetection).toHaveBeenCalledOnce()
    expect(getIsDetecting()).toBe(false) // cancel hat den State zurueckgesetzt

    // Der haengende Run loest verspaetet auf — darf isDetecting NICHT reaktivieren
    resolveDetect({ success: false, scenes: [] })
    await runPromise
    expect(getIsDetecting()).toBe(false)
  })
})
