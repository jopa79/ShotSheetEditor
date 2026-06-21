/**
 * Tests fuer ffmpegJobManager.ts (Welle 2)
 *
 * Prueft:
 * 1. JobError-Klassifikation (cancelled / ffmpeg-not-found / failed + Code)
 * 2. detect-JobType: activeJobCount steigt, killAll bricht detect ab
 * 3. onStderrLine-Callback empfaengt vollstaendige Zeilen
 *
 * Mock-Strategie: vi.hoisted() fuer spawn-Mock vor vi.mock()-Factory.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
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

// --- Hilfsfunktion: Fake-ChildProcess ---
function createFakeProcess() {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter
    stderr: EventEmitter
    kill: typeof mockKill
    stdin: null
  }
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = mockKill
  proc.stdin = null
  return proc
}

// --- Tests ---

describe('ffmpegJobManager — JobError-Klassifikation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSpawn.mockReset()
    mockKill.mockReset()
    mockSpawn.mockImplementation(() => createFakeProcess())
  })

  it('done rejects mit JobError.kind=cancelled wenn close code=null', async () => {
    const { startJob, JobError } = await import('../../../src/main/ffmpegJobManager')

    let fakeProc!: ReturnType<typeof createFakeProcess>
    mockSpawn.mockImplementation(() => {
      fakeProc = createFakeProcess()
      return fakeProc
    })

    const job = startJob({ type: 'transcode', args: ['-i', 'test.mp4'] })

    // Code null = SIGTERM/killed
    fakeProc.emit('close', null)

    await expect(job.done).rejects.toSatisfy((err: unknown) => {
      return err instanceof JobError && err.kind === 'cancelled'
    })
  })

  it('done rejects mit JobError.kind=failed+code wenn close code != 0', async () => {
    const { startJob, JobError } = await import('../../../src/main/ffmpegJobManager')

    let fakeProc!: ReturnType<typeof createFakeProcess>
    mockSpawn.mockImplementation(() => {
      fakeProc = createFakeProcess()
      return fakeProc
    })

    const job = startJob({ type: 'transcode', args: ['-i', 'test.mp4'] })
    fakeProc.emit('close', 2)

    await expect(job.done).rejects.toSatisfy((err: unknown) => {
      return err instanceof JobError && err.kind === 'failed' && err.code === 2
    })
  })

  it('done rejects mit JobError.kind=failed bei spawn error', async () => {
    const { startJob, JobError } = await import('../../../src/main/ffmpegJobManager')

    let fakeProc!: ReturnType<typeof createFakeProcess>
    mockSpawn.mockImplementation(() => {
      fakeProc = createFakeProcess()
      return fakeProc
    })

    const job = startJob({ type: 'transcode', args: ['-i', 'test.mp4'] })
    fakeProc.emit('error', new Error('ENOENT'))

    await expect(job.done).rejects.toSatisfy((err: unknown) => {
      return err instanceof JobError && err.kind === 'failed'
    })
  })

  it('done rejects mit JobError.kind=ffmpeg-not-found wenn kein ffmpeg-Pfad', async () => {
    // ffmpegBridge via Spy temporaer auf null setzen
    const ffmpegBridgeMod = await import('../../../src/main/ffmpegBridge')
    const spy = vi.spyOn(ffmpegBridgeMod, 'getFFmpegPath').mockReturnValue(null as unknown as string)

    const { startJob, JobError } = await import('../../../src/main/ffmpegJobManager')
    const job = startJob({ type: 'transcode', args: [] })

    await expect(job.done).rejects.toSatisfy((err: unknown) => {
      return err instanceof JobError && err.kind === 'ffmpeg-not-found'
    })

    spy.mockRestore()
  })
})

describe('ffmpegJobManager — detect JobType', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSpawn.mockReset()
    mockKill.mockReset()
  })

  it('activeJobCount steigt auf 1 wenn detect-Job laeuft', async () => {
    const { startJob, activeJobCount } = await import('../../../src/main/ffmpegJobManager')

    let fakeProc!: ReturnType<typeof createFakeProcess>
    mockSpawn.mockImplementation(() => {
      fakeProc = createFakeProcess()
      return fakeProc
    })

    const job = startJob({
      type: 'detect',
      args: ['-i', 'test.mp4', '-f', 'null', '-'],
    })

    // Prozess laeuft noch → count = 1
    expect(activeJobCount()).toBeGreaterThanOrEqual(1)

    // Aufraumen
    fakeProc.emit('close', 0)
    await job.done
  })

  it('killAll() bricht laufenden detect-Job ab', async () => {
    const { startJob, killAll, activeJobCount } = await import(
      '../../../src/main/ffmpegJobManager'
    )

    let fakeProc!: ReturnType<typeof createFakeProcess>
    mockSpawn.mockImplementation(() => {
      fakeProc = createFakeProcess()
      return fakeProc
    })

    startJob({ type: 'detect', args: ['-i', 'test.mp4'] })
    expect(activeJobCount()).toBeGreaterThanOrEqual(1)

    killAll()

    // Job wurde via kill() aus der Map entfernt
    expect(activeJobCount()).toBe(0)
    expect(mockKill).toHaveBeenCalledWith('SIGTERM')
  })

  it('onStderrLine-Callback wird fuer jede vollstaendige Zeile aufgerufen', async () => {
    const { startJob } = await import('../../../src/main/ffmpegJobManager')

    let fakeProc!: ReturnType<typeof createFakeProcess>
    mockSpawn.mockImplementation(() => {
      fakeProc = createFakeProcess()
      return fakeProc
    })

    const receivedLines: string[] = []
    const job = startJob({
      type: 'detect',
      args: ['-i', 'test.mp4'],
      onStderrLine: (line) => receivedLines.push(line),
    })

    // Zwei vollstaendige Zeilen + unvollstaendige Rest-Zeile
    fakeProc.stderr.emit('data', Buffer.from('line one\nline two\nincomplete'))
    fakeProc.emit('close', 0)
    await job.done

    expect(receivedLines).toContain('line one')
    expect(receivedLines).toContain('line two')
    // Unvollstaendige Zeile wird NICHT weitergeleitet (kein trailing \n)
    expect(receivedLines).not.toContain('incomplete')
  })

  it('onStderrLine wird fuer Zeilen aus mehreren Chunks korrekt zusammengefuehrt', async () => {
    const { startJob } = await import('../../../src/main/ffmpegJobManager')

    let fakeProc!: ReturnType<typeof createFakeProcess>
    mockSpawn.mockImplementation(() => {
      fakeProc = createFakeProcess()
      return fakeProc
    })

    const receivedLines: string[] = []
    const job = startJob({
      type: 'detect',
      args: ['-i', 'test.mp4'],
      onStderrLine: (line) => receivedLines.push(line),
    })

    // Zeile ueber zwei Chunks aufgespalten
    fakeProc.stderr.emit('data', Buffer.from(' pts_time:'))
    fakeProc.stderr.emit('data', Buffer.from('10.5\n'))
    fakeProc.emit('close', 0)
    await job.done

    // Die zusammengefuegte Zeile muss ankommen
    const joined = receivedLines.find((l) => l.includes('pts_time:'))
    expect(joined).toBeDefined()
    expect(joined).toContain('10.5')
  })
})
