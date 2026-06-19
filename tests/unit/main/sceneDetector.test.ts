/**
 * Charakterisierungs-Tests fuer sceneDetector.ts
 *
 * Ziel: IST-Verhalten festnageln BEVOR der Refactor zum FFmpegJobManager beginnt.
 * Dokumentiert: ffmpeg-Args fuer Scene-Detection, pts_time-Parsing, Progress mit newScenes,
 * cancelDetection()-Semantik (inkl. _cancelRequested-Flag).
 *
 * Mock-Strategie: vi.hoisted() fuer Mock-Funktionen in vi.mock()-Factories.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { EventEmitter } from 'events'

// --- vi.hoisted(): Mock-Funktionen VOR vi.mock()-Factories ---
const { mockSpawn, mockKill } = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
  mockKill: vi.fn(),
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

// --- Hilfsfunktion ---
function createFakeProcess() {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter
    stderr: EventEmitter
    kill: typeof mockKill
  }
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = mockKill
  return proc
}

// --- Typen ---
interface DetectedScene {
  index: number
  startTime: number
  tc: string
}

interface DetectionProgressData {
  progress: number
  processedTime: number
  totalDuration: number
  scenesDetected: number
  newScenes: DetectedScene[]
}

interface DetectionResult {
  success: boolean
  scenes?: DetectedScene[]
  canceled?: boolean
  error?: string
}

// --- Modul-Imports (einmalig nach Mock-Setup) ---

let detectScenes: (
  videoPath: string,
  threshold: number,
  onProgress?: (progress: DetectionProgressData) => void,
) => Promise<DetectionResult>
let cancelDetection: () => void

beforeAll(async () => {
  const mod = await import('../../../src/main/sceneDetector')
  detectScenes = mod.detectScenes
  cancelDetection = mod.cancelDetection
})

// --- Tests ---

describe('sceneDetector — Charakterisierungs-Tests', () => {
  let fakeProcess: ReturnType<typeof createFakeProcess>

  beforeEach(() => {
    // mockReset loescht mockImplementationOnce-Queues (clearAllMocks tut das nicht)
    vi.clearAllMocks()
    mockSpawn.mockReset()
    mockKill.mockReset()

    fakeProcess = createFakeProcess()
    mockSpawn.mockReturnValue(fakeProcess)
  })

  // ----------------------------------------------------------------
  // 1. FFmpeg-Args Charakterisierung
  // ----------------------------------------------------------------

  it('ruft spawn mit select/showinfo-Filter und null-Output auf', async () => {
    const promise = detectScenes('/tmp/video.mp4', 0.3)
    fakeProcess.emit('close', 0)
    await promise

    expect(mockSpawn).toHaveBeenCalledOnce()
    const [ffmpegPath, args] = mockSpawn.mock.calls[0]

    expect(ffmpegPath).toBe('/usr/local/bin/ffmpeg')
    expect(args).toContain('-i')
    expect(args).toContain('/tmp/video.mp4')
    expect(args).toContain('-f')
    expect(args).toContain('null')
    expect(args).toContain('-vsync')
    expect(args).toContain('vfr')

    // Video-Filter muss select+showinfo mit threshold=0.3 enthalten
    const vfIndex = args.indexOf('-vf')
    expect(vfIndex).toBeGreaterThan(-1)
    const vfValue: string = args[vfIndex + 1]
    expect(vfValue).toMatch(/select=/)
    expect(vfValue).toMatch(/showinfo/)
    expect(vfValue).toMatch(/0\.3/)
  })

  it('klemmt Threshold auf safeThreshold-Bereich [0.01, 1.0]', async () => {
    const promise = detectScenes('/tmp/video.mp4', 999)
    fakeProcess.emit('close', 0)
    await promise

    const [, args] = mockSpawn.mock.calls[0]
    const vfIndex = args.indexOf('-vf')
    const vfValue: string = args[vfIndex + 1]
    // Threshold muss exakt 1 sein (geklammert auf 1.0)
    expect(vfValue).toMatch(/gt\(scene,1\)/)
    expect(vfValue).not.toMatch(/999/)
  })

  // ----------------------------------------------------------------
  // 2. Scene-Detection: pts_time-Parsing
  // ----------------------------------------------------------------

  it('parst pts_time aus stderr und sammelt Szenen', async () => {
    let resolvedResult: DetectionResult | null = null
    const promise = detectScenes('/tmp/video.mp4', 0.3).then((r) => {
      resolvedResult = r
      return r
    })

    fakeProcess.stderr.emit(
      'data',
      Buffer.from('  Duration: 00:01:40.00, start: 0.000000, bitrate: 5000 kb/s\n'),
    )
    fakeProcess.stderr.emit('data', Buffer.from(' pts_time:10.5\n'))
    fakeProcess.stderr.emit('data', Buffer.from(' pts_time:25.0\n'))
    fakeProcess.stderr.emit('data', Buffer.from(' pts_time:55.333\n'))

    fakeProcess.emit('close', 0)
    await promise

    expect(resolvedResult).not.toBeNull()
    expect(resolvedResult!.success).toBe(true)
    expect(resolvedResult!.scenes).toHaveLength(3)
    expect(resolvedResult!.scenes![0].startTime).toBeCloseTo(10.5)
    expect(resolvedResult!.scenes![1].startTime).toBeCloseTo(25.0)
    expect(resolvedResult!.scenes![2].startTime).toBeCloseTo(55.333)
  })

  it('dedupliziert pts_time (gleiche Zeit nicht zweimal einfuegen)', async () => {
    const promise = detectScenes('/tmp/video.mp4', 0.3)

    fakeProcess.stderr.emit(
      'data',
      Buffer.from('  Duration: 00:01:00.00, start: 0.000000, bitrate: 5000 kb/s\n'),
    )
    // Gleicher Timestamp dreimal in einem Chunk
    fakeProcess.stderr.emit('data', Buffer.from(' pts_time:10.0\n pts_time:10.0\n pts_time:10.0\n'))

    fakeProcess.emit('close', 0)
    const result = await promise

    expect(result.scenes).toHaveLength(1)
  })

  // ----------------------------------------------------------------
  // 3. Progress mit newScenes (rt-002)
  // ----------------------------------------------------------------

  it('sendet nur NEU erkannte Szenen in newScenes (nicht alle bisher)', async () => {
    const onProgress = vi.fn()
    const promise = detectScenes('/tmp/video.mp4', 0.3, onProgress)

    // Duration-Chunk: setzt totalDuration, loest ersten Progress aus (processedTime=0, newScenes=[])
    fakeProcess.stderr.emit(
      'data',
      Buffer.from('  Duration: 00:01:00.00, start: 0.000000, bitrate: 5000 kb/s\n'),
    )

    // Erste Szene separat senden → zweiter Progress-Call (newScenes=[{10.0}])
    fakeProcess.stderr.emit('data', Buffer.from(' pts_time:10.0\n'))
    // Zweite Szene separat senden → dritter Progress-Call (newScenes=[{20.0}])
    fakeProcess.stderr.emit('data', Buffer.from(' pts_time:20.0\n'))

    fakeProcess.emit('close', 0)
    await promise

    // IST-Verhalten: 3 Progress-Calls (Duration-Chunk + 2x pts_time-Chunks)
    expect(onProgress).toHaveBeenCalledTimes(3)

    // Dritter Call darf nur die zweite Szene als newScene enthalten
    const thirdCall = onProgress.mock.calls[2][0]
    expect(thirdCall.newScenes).toHaveLength(1)
    expect(thirdCall.newScenes[0].startTime).toBeCloseTo(20.0)
    expect(thirdCall.scenesDetected).toBe(2)
  })

  it('sendet progress mit totalDuration und processedTime', async () => {
    const onProgress = vi.fn()
    const promise = detectScenes('/tmp/video.mp4', 0.3, onProgress)

    // Duration und pts_time in EINEM Chunk (einen Progress-Call)
    fakeProcess.stderr.emit(
      'data',
      Buffer.from(
        '  Duration: 00:01:40.00, start: 0.000000, bitrate: 5000 kb/s\n pts_time:50.0\n',
      ),
    )

    fakeProcess.emit('close', 0)
    await promise

    // IST-Verhalten: 1 Progress-Call (ein Chunk mit Duration + pts_time)
    expect(onProgress).toHaveBeenCalledTimes(1)
    const call = onProgress.mock.calls[0][0]
    expect(call.totalDuration).toBeCloseTo(100)
    expect(call.processedTime).toBeCloseTo(50)
    expect(call.progress).toBeCloseTo(50)
  })

  // ----------------------------------------------------------------
  // 4. Cancel-Verhalten (_cancelRequested-Flag)
  // ----------------------------------------------------------------

  it('cancelDetection() ruft kill(SIGTERM) auf dem laufenden Prozess auf', async () => {
    const promise = detectScenes('/tmp/video.mp4', 0.3)

    cancelDetection()
    fakeProcess.emit('close', null)
    await promise

    expect(mockKill).toHaveBeenCalledWith('SIGTERM')
  })

  it('cancelDetection() fuehrt zu { success: false, canceled: true }', async () => {
    const promise = detectScenes('/tmp/video.mp4', 0.3)

    cancelDetection()
    fakeProcess.emit('close', null)
    const result = await promise

    expect(result.success).toBe(false)
    expect(result.canceled).toBe(true)
    expect(result.error).toBe('Detection canceled')
  })

  it('zweiter detectScenes-Aufruf cancelt die erste Detection', async () => {
    const fakeProcess2 = createFakeProcess()
    mockSpawn.mockReturnValueOnce(fakeProcess).mockReturnValueOnce(fakeProcess2)

    const promise1 = detectScenes('/tmp/video1.mp4', 0.3)
    // Zweiter Aufruf cancelt intern via cancelDetection()
    const promise2 = detectScenes('/tmp/video2.mp4', 0.3)

    // Erster Prozess schliessen (durch cancel)
    fakeProcess.emit('close', null)
    // Zweiter Prozess erfolgreich
    fakeProcess2.emit('close', 0)

    const [result1] = await Promise.all([promise1, promise2])

    // Erster Prozess muss kill() erhalten haben
    expect(mockKill).toHaveBeenCalledWith('SIGTERM')
    // Erster Job war canceled
    expect(result1.canceled).toBe(true)
  })

  it('cancelDetection() ohne laufenden Prozess wirft keinen Fehler', () => {
    expect(() => cancelDetection()).not.toThrow()
    expect(mockKill).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------
  // 5. Close-Handler (success / error)
  // ----------------------------------------------------------------

  it('resolve({ success: true, scenes }) bei exit code 0', async () => {
    const promise = detectScenes('/tmp/video.mp4', 0.3)
    fakeProcess.emit('close', 0)

    const result = await promise

    expect(result.success).toBe(true)
    expect(result.scenes).toBeDefined()
    expect(Array.isArray(result.scenes)).toBe(true)
  })

  it('resolve({ success: false, error }) bei exit code != 0', async () => {
    const promise = detectScenes('/tmp/video.mp4', 0.3)
    fakeProcess.emit('close', 1)

    const result = await promise

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/ffmpeg failed with code 1/)
  })

  it('resolve({ success: false }) bei spawn error', async () => {
    const promise = detectScenes('/tmp/video.mp4', 0.3)
    fakeProcess.emit('error', new Error('spawn ENOENT'))

    const result = await promise

    expect(result.success).toBe(false)
    expect(result.error).toBe('spawn ENOENT')
  })
})
