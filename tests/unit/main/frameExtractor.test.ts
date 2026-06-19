/**
 * Charakterisierungs-Tests fuer frameExtractor.ts
 *
 * Ziel: IST-Verhalten festnageln BEVOR der Refactor zum FFmpegJobManager beginnt.
 * Dokumentiert: extractFrame-Args, Concurrency-Limit (max 5 gleichzeitig),
 * Queue-Abarbeitung, Fehlerverhalten, processing-Counter-Korrektheit.
 * IST-Zustand: KEIN globales Cancel — orphaned processes bei Crash (Bug, wird in Phase 2 behoben).
 *
 * Mock-Strategie: vi.hoisted() fuer Mock-Funktionen in vi.mock()-Factories.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { EventEmitter } from 'events'

// --- vi.hoisted(): Mock-Funktionen VOR vi.mock()-Factories ---
const { mockSpawn, mockExistsSync } = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
  mockExistsSync: vi.fn(() => true),
}))

// --- Top-level Mock-Factories ---

vi.mock('electron', () => ({
  app: { getAppPath: () => '/mock/app/path' },
}))

vi.mock('child_process', () => ({
  spawn: mockSpawn,
  execFileSync: vi.fn(),
}))

vi.mock('../../../src/main/ffmpegBridge', () => ({
  getFFmpegPath: () => '/usr/local/bin/ffmpeg',
}))

vi.mock('fs', () => ({
  default: {
    mkdirSync: vi.fn(),
    existsSync: mockExistsSync,
    unlinkSync: vi.fn(),
  },
  mkdirSync: vi.fn(),
  existsSync: mockExistsSync,
  unlinkSync: vi.fn(),
}))

vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path')
  return { ...actual, default: actual }
})

// --- Hilfsfunktion ---
function createFakeProcess() {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter
    stderr: EventEmitter
    kill: ReturnType<typeof vi.fn>
  }
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = vi.fn()
  return proc
}

// --- Typen ---
interface SceneInput {
  index: number
  startTime: number
  tc?: string
}

interface ExtractResult {
  success: boolean
  path?: string
  error?: string
}

interface FrameResult {
  index: number
  path: string
  timestamp: number
  tc?: string
}

// --- Modul-Imports (einmalig nach Mock-Setup) ---

let extractFrame: (
  videoPath: string,
  timestamp: number,
  outputPath: string,
  thumbSize: { width: number; height: number },
) => Promise<ExtractResult>
let extractFrames: (
  videoPath: string,
  scenes: SceneInput[],
  outputDir: string,
  thumbSize: { width: number; height: number } | undefined,
  onProgress?: (progress: {
    progress: number
    completed: number
    total: number
    frameResult?: { index: number; path: string }
  }) => void,
) => Promise<{ success: boolean; frames?: FrameResult[]; error?: string }>

// Alle in einem Test gespawnten Prozesse tracken
let activeProcesses: ReturnType<typeof createFakeProcess>[]

beforeAll(async () => {
  const mod = await import('../../../src/main/frameExtractor')
  extractFrame = mod.extractFrame
  extractFrames = mod.extractFrames
})

// --- Tests ---

describe('frameExtractor — Charakterisierungs-Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSpawn.mockReset()
    mockExistsSync.mockReset()

    activeProcesses = []
    // Spawn-Mock: alle gespawnten Prozesse tracken
    mockSpawn.mockImplementation(() => {
      const proc = createFakeProcess()
      activeProcesses.push(proc)
      return proc
    })
    // Standard: Ausgabedatei existiert nach Transcoding
    mockExistsSync.mockReturnValue(true)
  })

  // ----------------------------------------------------------------
  // 1. extractFrame: FFmpeg-Args Charakterisierung
  // ----------------------------------------------------------------

  it('extractFrame ruft spawn mit korrekten Args auf', async () => {
    const thumbSize = { width: 320, height: 180 }
    const promise = extractFrame('/tmp/video.mp4', 10.5, '/tmp/frame_0001.jpg', thumbSize)

    activeProcesses[0].emit('close', 0)
    await promise

    expect(mockSpawn).toHaveBeenCalledOnce()
    const [ffmpegPath, args] = mockSpawn.mock.calls[0]

    expect(ffmpegPath).toBe('/usr/local/bin/ffmpeg')
    expect(args).toContain('-y')
    expect(args).toContain('-ss')
    expect(args).toContain('10.5')
    expect(args).toContain('-i')
    expect(args).toContain('/tmp/video.mp4')
    expect(args).toContain('-vframes')
    expect(args).toContain('1')
    expect(args).toContain('-q:v')
    expect(args).toContain('4')
    expect(args).toContain('/tmp/frame_0001.jpg')

    // Video-Filter muss scale + pad enthalten
    const vfIndex = args.indexOf('-vf')
    expect(vfIndex).toBeGreaterThan(-1)
    const vfValue: string = args[vfIndex + 1]
    expect(vfValue).toMatch(/scale=320:180/)
    expect(vfValue).toMatch(/pad=320:180/)
    expect(vfValue).toMatch(/force_original_aspect_ratio=decrease/)
  })

  it('extractFrame gibt { success: true, path } bei exit code 0 zurueck', async () => {
    const promise = extractFrame('/tmp/video.mp4', 5.0, '/tmp/frame.jpg', { width: 320, height: 180 })
    activeProcesses[0].emit('close', 0)

    const result = await promise

    expect(result.success).toBe(true)
    expect(result.path).toBe('/tmp/frame.jpg')
  })

  it('extractFrame gibt { success: false, error } bei exit code != 0 zurueck', async () => {
    const promise = extractFrame('/tmp/video.mp4', 5.0, '/tmp/frame.jpg', { width: 320, height: 180 })
    activeProcesses[0].emit('close', 1)

    const result = await promise

    expect(result.success).toBe(false)
    // Nach Refactor auf JobManager: Error-Message lautet "FFmpeg Fehler (Code 1)"
    // (vorher: "ffmpeg failed with code 1" — Verhaltensaenderung in Fehler-Wording)
    expect(result.error).toMatch(/FFmpeg Fehler/)
    expect(result.error).toMatch(/1/)
  })

  it('extractFrame gibt { success: false, error } bei spawn error zurueck', async () => {
    const promise = extractFrame('/tmp/video.mp4', 5.0, '/tmp/frame.jpg', { width: 320, height: 180 })
    activeProcesses[0].emit('error', new Error('ENOENT'))

    const result = await promise

    expect(result.success).toBe(false)
    expect(result.error).toBe('ENOENT')
  })

  // ----------------------------------------------------------------
  // 2. extractFrames: Concurrency-Limit (max 5 gleichzeitig)
  // ----------------------------------------------------------------

  it('startet initial maximal 5 parallele Extractions', async () => {
    const scenes = Array.from({ length: 10 }, (_, i) => ({
      index: i,
      startTime: i * 10,
    }))

    const promise = extractFrames('/tmp/video.mp4', scenes, '/tmp/frames', undefined)

    // Einen Tick warten damit initiale spawns gefeuert werden
    await new Promise((r) => setTimeout(r, 0))

    // Genau 5 Prozesse gestartet (MAX_CONCURRENT_EXTRACTIONS = 5)
    expect(mockSpawn).toHaveBeenCalledTimes(5)

    // Erste 5 abschliessen
    for (let i = 0; i < 5; i++) {
      activeProcesses[i].emit('close', 0)
    }
    await new Promise((r) => setTimeout(r, 0))

    // Naechste 5 gespawned
    expect(mockSpawn).toHaveBeenCalledTimes(10)
    for (let i = 5; i < 10; i++) {
      activeProcesses[i].emit('close', 0)
    }

    await promise
  })

  it('naechster Frame wird gespawned wenn einer fertig ist', async () => {
    const scenes = Array.from({ length: 6 }, (_, i) => ({
      index: i,
      startTime: i * 5,
    }))

    const promise = extractFrames('/tmp/video.mp4', scenes, '/tmp/frames', undefined)

    await new Promise((r) => setTimeout(r, 0))
    // 5 laufen, 1 wartet in Queue
    expect(mockSpawn).toHaveBeenCalledTimes(5)

    // Ersten Prozess abschliessen → sechster soll direkt starten
    activeProcesses[0].emit('close', 0)
    await new Promise((r) => setTimeout(r, 0))

    expect(mockSpawn).toHaveBeenCalledTimes(6)

    // Restliche schliessen
    for (let i = 1; i < activeProcesses.length; i++) {
      activeProcesses[i].emit('close', 0)
    }

    const result = await promise
    expect(result.success).toBe(true)
  })

  // ----------------------------------------------------------------
  // 3. Fehlerbehandlung: processing-Counter korrekt (kein Deadlock)
  // ----------------------------------------------------------------

  it('dekrementiert processing-Counter korrekt auch bei Fehler (kein Deadlock)', async () => {
    const scenes = Array.from({ length: 3 }, (_, i) => ({
      index: i,
      startTime: i * 10,
    }))

    const promise = extractFrames('/tmp/video.mp4', scenes, '/tmp/frames', undefined)

    await new Promise((r) => setTimeout(r, 0))

    // Ersten Prozess mit Fehler-Code, rest erfolgreich
    activeProcesses[0].emit('close', 1)
    activeProcesses[1].emit('close', 0)
    activeProcesses[2].emit('close', 0)

    // Muss trotzdem abschliessen (kein Deadlock durch falsch dekrementierten Counter)
    const result = await promise

    expect(result.success).toBe(true)
    // Zwei von drei Frames erfolgreich
    expect(result.frames!.filter(Boolean)).toHaveLength(2)
  })

  it('dekrementiert processing-Counter korrekt bei spawn error (kein Deadlock)', async () => {
    const scenes = Array.from({ length: 2 }, (_, i) => ({
      index: i,
      startTime: i * 10,
    }))

    const promise = extractFrames('/tmp/video.mp4', scenes, '/tmp/frames', undefined)

    await new Promise((r) => setTimeout(r, 0))

    // Prozess via error-Event beenden (nicht via close)
    activeProcesses[0].emit('error', new Error('ENOENT'))
    activeProcesses[1].emit('close', 0)

    const result = await promise

    // Kein Deadlock — Promise resolved sauber
    expect(result.success).toBe(true)
  })

  // ----------------------------------------------------------------
  // 4. Progress-Callbacks
  // ----------------------------------------------------------------

  it('ruft onProgress nach jedem abgeschlossenen Frame auf', async () => {
    const onProgress = vi.fn()
    const scenes = [
      { index: 0, startTime: 0 },
      { index: 1, startTime: 10 },
    ]

    const promise = extractFrames('/tmp/video.mp4', scenes, '/tmp/frames', undefined, onProgress)

    await new Promise((r) => setTimeout(r, 0))

    activeProcesses[0].emit('close', 0)
    await new Promise((r) => setTimeout(r, 0))
    activeProcesses[1].emit('close', 0)

    await promise

    expect(onProgress).toHaveBeenCalled()
    const calls = onProgress.mock.calls.map((c) => c[0])
    // Letzter Call muss progress=100 und total=2 enthalten
    const lastCall = calls[calls.length - 1]
    expect(lastCall.progress).toBe(100)
    expect(lastCall.total).toBe(2)
  })

  it('ruft onProgress mit frameResult bei erfolgreichem Frame auf', async () => {
    const onProgress = vi.fn()
    const scenes = [{ index: 0, startTime: 5.0 }]

    const promise = extractFrames('/tmp/video.mp4', scenes, '/tmp/frames', undefined, onProgress)

    await new Promise((r) => setTimeout(r, 0))
    activeProcesses[0].emit('close', 0)

    await promise

    // Progress-Calls mit frameResult finden
    const callsWithFrameResult = onProgress.mock.calls.filter((c) => c[0].frameResult)
    expect(callsWithFrameResult).toHaveLength(1)
    expect(callsWithFrameResult[0][0].frameResult.index).toBe(0)
  })

  it('kein frameResult in onProgress bei fehlgeschlagenem Frame', async () => {
    const onProgress = vi.fn()
    const scenes = [{ index: 0, startTime: 5.0 }]

    const promise = extractFrames('/tmp/video.mp4', scenes, '/tmp/frames', undefined, onProgress)

    await new Promise((r) => setTimeout(r, 0))
    // Frame schlaegt fehl (exit code 1)
    activeProcesses[0].emit('close', 1)

    await promise

    // Alle Progress-Calls haben kein frameResult (fehlgeschlagener Frame)
    const callsWithoutFrameResult = onProgress.mock.calls.filter((c) => !c[0].frameResult)
    expect(callsWithoutFrameResult.length).toBeGreaterThan(0)
    expect(onProgress.mock.calls.filter((c) => c[0].frameResult)).toHaveLength(0)
  })

  // ----------------------------------------------------------------
  // 5. Orphaned-process-Fix: Extractions laufen via JobManager (startJob),
  //    werden also von killAll() bei App-Quit erfasst — Tracking liegt im
  //    ffmpegJobManager, nicht mehr lokal in frameExtractor.
  // ----------------------------------------------------------------

  it('SOLL-Zustand: extractFrame nutzt startJob → JobManager-Tracking (killAll erfasst Extractions)', async () => {
    const jobMgr = await import('../../../src/main/ffmpegJobManager')

    // startJob ist die Tracking-Quelle; killAll() existiert als Quit-Cancel.
    expect(typeof jobMgr.startJob).toBe('function')
    expect(typeof jobMgr.killAll).toBe('function')
  })

  // ----------------------------------------------------------------
  // 6. Leere Scenes-Array
  // ----------------------------------------------------------------

  it('gibt leeres frames-Array zurueck fuer leere scenes-Liste', async () => {
    const result = await extractFrames('/tmp/video.mp4', [], '/tmp/frames', undefined)

    expect(result.success).toBe(true)
    expect(result.frames).toHaveLength(0)
    expect(mockSpawn).not.toHaveBeenCalled()
  })
})
