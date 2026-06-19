/**
 * Charakterisierungs-Tests fuer proxyGenerator.ts
 *
 * Ziel: IST-Verhalten festnageln BEVOR der Refactor zum FFmpegJobManager beginnt.
 * Diese Tests dokumentieren: welche ffmpeg-Args, wie Progress-Parsing funktioniert,
 * wie cancelTranscoding() sich verhaelt, und wie der close-Handler reagiert.
 *
 * Mock-Strategie: vi.hoisted() fuer Mock-Funktionen die in vi.mock()-Factories genutzt werden.
 * Vitest hoisted vi.mock()-Aufrufe vor Imports — vi.hoisted() stellt sicher dass die
 * vi.fn()-Instanzen vor den vi.mock()-Factories verfuegbar sind.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { EventEmitter } from 'events'

// --- vi.hoisted(): Mock-Funktionen werden VOR vi.mock()-Factories instanziiert ---
const { mockSpawn, mockRealpathSync, mockStatSync, mockExistsSync, mockKill } = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
  mockRealpathSync: vi.fn((p: unknown) => p as string),
  mockStatSync: vi.fn(() => {
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
  }),
  mockExistsSync: vi.fn(() => true),
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

vi.mock('fs', () => ({
  default: {
    mkdirSync: vi.fn(),
    statSync: mockStatSync,
    existsSync: mockExistsSync,
    unlinkSync: vi.fn(),
    realpathSync: mockRealpathSync,
    rmSync: vi.fn(),
  },
  mkdirSync: vi.fn(),
  statSync: mockStatSync,
  existsSync: mockExistsSync,
  unlinkSync: vi.fn(),
  realpathSync: mockRealpathSync,
  rmSync: vi.fn(),
}))

vi.mock('os', () => ({
  default: {
    homedir: () => '/mock/home',
    tmpdir: () => '/tmp',
  },
  homedir: () => '/mock/home',
  tmpdir: () => '/tmp',
}))

vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path')
  return { ...actual, default: actual }
})

vi.mock('crypto', async () => {
  const actual = await vi.importActual<typeof import('crypto')>('crypto')
  return { ...actual, default: actual }
})

// --- Hilfsfunktion: Fake-ChildProcess ---
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

// --- Modul-Imports (einmalig nach Mock-Setup) ---

let generateProxy: (
  inputPath: string,
  duration: number,
  onProgress?: (progress: { progress: number }) => void,
) => Promise<{ success: boolean; proxyPath?: string; cached?: boolean; error?: string }>
let cancelTranscoding: () => void

beforeAll(async () => {
  const mod = await import('../../../src/main/proxyGenerator')
  generateProxy = mod.generateProxy
  cancelTranscoding = mod.cancelTranscoding
})

// --- Tests ---

describe('proxyGenerator — Charakterisierungs-Tests', () => {
  let fakeProcess: ReturnType<typeof createFakeProcess>

  beforeEach(() => {
    // clearAllMocks resetet .mock.calls etc., aber NICHT mockImplementationOnce-Queues.
    // mockStatSync.mockReset() loescht die Queue vollstaendig bevor neue Implementierung gesetzt wird.
    vi.clearAllMocks()
    mockStatSync.mockReset()
    mockSpawn.mockReset()
    mockRealpathSync.mockReset()
    mockExistsSync.mockReset()

    fakeProcess = createFakeProcess()
    mockSpawn.mockReturnValue(fakeProcess)

    // Standard: realpathSync gibt Pfad unveraendert zurueck (kein Symlink-Problem)
    mockRealpathSync.mockImplementation((p: unknown) => p as string)

    // Standard: Proxy existiert NOCH NICHT (kein Cache-Hit)
    // Erster statSync-Aufruf (getExistingProxy): wirft ENOENT → kein Cache-Hit
    // Zweiter statSync-Aufruf (close-Handler nach Transcoding): gibt { size: 1000 } zurueck
    mockStatSync
      .mockImplementationOnce(() => {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      })
      .mockReturnValue({ size: 1000 })

    // existsSync: true nach Transcoding (Ausgabedatei vorhanden)
    mockExistsSync.mockReturnValue(true)
  })

  // ----------------------------------------------------------------
  // 1. FFmpeg-Args Charakterisierung
  // ----------------------------------------------------------------

  it('ruft spawn mit korrekten ffmpeg-Args auf', async () => {
    const promise = generateProxy('/mock/home/video.mov', 60)
    fakeProcess.emit('close', 0)
    await promise

    expect(mockSpawn).toHaveBeenCalledOnce()
    const [ffmpegPath, args] = mockSpawn.mock.calls[0]

    expect(ffmpegPath).toBe('/usr/local/bin/ffmpeg')
    expect(args).toContain('-i')
    expect(args).toContain('/mock/home/video.mov')
    expect(args).toContain('-c:v')
    expect(args).toContain('libx264')
    expect(args).toContain('-pix_fmt')
    expect(args).toContain('yuv420p')
    expect(args).toContain('-preset')
    expect(args).toContain('ultrafast')
    expect(args).toContain('-crf')
    expect(args).toContain('28')
    expect(args).toContain('-c:a')
    expect(args).toContain('aac')
    expect(args).toContain('-movflags')
    expect(args).toContain('+faststart')
    expect(args).toContain('-y')

    // Video-Filter muss scale=-2:720 enthalten
    const vfIndex = args.indexOf('-vf')
    expect(vfIndex).toBeGreaterThan(-1)
    expect(args[vfIndex + 1]).toBe('scale=-2:720')
  })

  // ----------------------------------------------------------------
  // 2. Progress-Parsing via stderr (time=HH:MM:SS.mmm)
  // ----------------------------------------------------------------

  it('parst stderr time= und ruft onProgress mit korrektem Prozentwert auf', async () => {
    const onProgress = vi.fn()
    const promise = generateProxy('/mock/home/video.mov', 100, onProgress)

    // FFmpeg schreibt Fortschritt auf stderr
    fakeProcess.stderr.emit(
      'data',
      Buffer.from('frame=  10 fps=30 time=00:00:50.00 bitrate=1000\n'),
    )
    fakeProcess.emit('close', 0)
    await promise

    expect(onProgress).toHaveBeenCalled()
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0]
    // 50s von 100s = 50%
    expect(lastCall.progress).toBe(50)
  })

  it('capped Progress bei maximal 99 (nicht 100 solange laufend)', async () => {
    const onProgress = vi.fn()
    const promise = generateProxy('/mock/home/video.mov', 10, onProgress)

    // Zeit > Dauer — soll auf 99 gecapped werden
    fakeProcess.stderr.emit(
      'data',
      Buffer.from('frame= 100 fps=30 time=00:00:20.00 bitrate=1000\n'),
    )
    fakeProcess.emit('close', 0)
    await promise

    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0]
    expect(lastCall.progress).toBeLessThanOrEqual(99)
  })

  it('ignoriert onProgress wenn duration=0', async () => {
    const onProgress = vi.fn()
    const promise = generateProxy('/mock/home/video.mov', 0, onProgress)
    fakeProcess.stderr.emit('data', Buffer.from('time=00:00:10.00\n'))
    fakeProcess.emit('close', 0)
    await promise

    // Bei duration=0 kein Progress-Callback
    expect(onProgress).not.toHaveBeenCalled()
  })

  it('parst mehrere time=-Treffer im selben Chunk und nimmt den letzten', async () => {
    const onProgress = vi.fn()
    const promise = generateProxy('/mock/home/video.mov', 100, onProgress)

    // Mehrere time=-Werte im selben Buffer-Chunk
    fakeProcess.stderr.emit(
      'data',
      Buffer.from(
        'time=00:00:10.00 bitrate=x\ntime=00:00:30.00 bitrate=x\ntime=00:01:00.00 bitrate=x\n',
      ),
    )
    fakeProcess.emit('close', 0)
    await promise

    expect(onProgress).toHaveBeenCalled()
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0]
    // Letzter Match: 60s von 100s = 60%
    expect(lastCall.progress).toBe(60)
  })

  // ----------------------------------------------------------------
  // 3. Cancel-Verhalten
  // ----------------------------------------------------------------

  it('cancelTranscoding() ruft kill(SIGTERM) auf dem laufenden Prozess auf', async () => {
    const promise = generateProxy('/mock/home/video.mov', 60)

    cancelTranscoding()
    // close mit null-Code simulieren (SIGTERM-Verhalten)
    fakeProcess.emit('close', null)
    await promise

    expect(mockKill).toHaveBeenCalledWith('SIGTERM')
  })

  it('zweiter generateProxy-Aufruf cancelt den ersten Prozess', async () => {
    const fakeProcess2 = createFakeProcess()
    mockSpawn.mockReturnValueOnce(fakeProcess).mockReturnValueOnce(fakeProcess2)

    // Erster Job starten
    const promise1 = generateProxy('/mock/home/video1.mov', 60)
    // Zweiter Job starten — soll ersten canceln (cancelTranscoding() wird intern aufgerufen)
    const promise2 = generateProxy('/mock/home/video2.mov', 60)

    // Erster Prozess: close mit null (durch cancel)
    fakeProcess.emit('close', null)
    // Zweiter Prozess: Erfolg
    fakeProcess2.emit('close', 0)

    await promise1
    await promise2

    // Erster Prozess muss kill() erhalten haben
    expect(mockKill).toHaveBeenCalledWith('SIGTERM')
  })

  it('cancelTranscoding() ohne laufenden Prozess wirft keinen Fehler', () => {
    expect(() => cancelTranscoding()).not.toThrow()
    expect(mockKill).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------
  // 4. Close-Handler (success / error)
  // ----------------------------------------------------------------

  it('resolve({ success: true, proxyPath }) bei exit code 0', async () => {
    const promise = generateProxy('/mock/home/video.mov', 60)
    // Tick abwarten damit der close-Listener registriert werden kann
    await new Promise((r) => setTimeout(r, 0))
    fakeProcess.emit('close', 0)

    const result = await promise

    expect(result.success).toBe(true)
    expect(result.proxyPath).toBeTruthy()
    expect(result.cached).toBeUndefined()
  })

  it('resolve({ success: false, error: FFmpeg Fehler }) bei exit code != 0', async () => {
    const promise = generateProxy('/mock/home/video.mov', 60)
    fakeProcess.emit('close', 1)

    const result = await promise

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/FFmpeg Fehler/)
  })

  it('resolve({ success: false, error: Transcoding abgebrochen }) bei code null', async () => {
    const promise = generateProxy('/mock/home/video.mov', 60)
    fakeProcess.emit('close', null)

    const result = await promise

    expect(result.success).toBe(false)
    expect(result.error).toBe('Transcoding abgebrochen')
  })

  it('resolve({ success: false }) bei spawn error', async () => {
    const promise = generateProxy('/mock/home/video.mov', 60)
    fakeProcess.emit('error', new Error('spawn ENOENT'))

    const result = await promise

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/FFmpeg Fehler/)
  })

  // ----------------------------------------------------------------
  // 5. Path-Security (aus Kandidat #1 erhalten)
  // ----------------------------------------------------------------

  it('reject Pfade ausserhalb von homedir/tmpdir', async () => {
    // realpathSync gibt einen Pfad ausserhalb von homedir und tmpdir zurueck
    mockRealpathSync.mockImplementation(() => '/etc/passwd')

    const result = await generateProxy('/etc/passwd', 60)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Access denied/)
  })
})
