// transcriber.test.ts — whisper.cpp-Aufruf, Segment-Parsing, Cancel, Binary-Aufloesung.
// Mockt child_process.spawn, audioExtractor, fs. Echtes Binary nicht noetig.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }))

vi.mock('child_process', () => ({ spawn: spawnMock }))
vi.mock('../../../src/main/audioExtractor', () => ({
  extractAudio: vi.fn().mockResolvedValue({ success: true, audioPath: '/tmp/a.wav' }),
}))
vi.mock('fs', () => ({ default: { existsSync: () => true }, existsSync: () => true }))

interface FakeProc extends EventEmitter {
  stdout: EventEmitter
  kill: ReturnType<typeof vi.fn>
}

function makeFakeProc(): FakeProc {
  const proc = new EventEmitter() as FakeProc
  proc.stdout = new EventEmitter()
  proc.kill = vi.fn()
  return proc
}

function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

describe('transcriber', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    process.env.WHISPER_BIN = '/usr/bin/whisper-cli'
    process.env.WHISPER_MODEL = '/models/ggml-base.bin'
    delete process.env.WHISPER_MODEL_DIR
  })

  afterEach(() => {
    delete process.env.WHISPER_BIN
    delete process.env.WHISPER_MODEL
    vi.restoreAllMocks()
  })

  describe('parseSegmentLine', () => {
    it('parst eine whisper.cpp-Segmentzeile', async () => {
      const { parseSegmentLine } = await import('../../../src/main/transcriber')
      const seg = parseSegmentLine('[00:00:01.500 --> 00:00:03.250]   Hello world')
      expect(seg).not.toBeNull()
      expect(seg!.startTime).toBeCloseTo(1.5, 3)
      expect(seg!.endTime).toBeCloseTo(3.25, 3)
      expect(seg!.text).toBe('Hello world')
    })

    it('null bei Nicht-Segmentzeilen / leerem Text', async () => {
      const { parseSegmentLine } = await import('../../../src/main/transcriber')
      expect(parseSegmentLine('whisper_init_from_file ...')).toBeNull()
      expect(parseSegmentLine('[00:00:00.000 --> 00:00:01.000]   ')).toBeNull()
    })
  })

  it('Fehler wenn das Binary fehlt (WHISPER_BIN unset)', async () => {
    delete process.env.WHISPER_BIN
    const { startTranscription } = await import('../../../src/main/transcriber')
    const res = await startTranscription({ videoPath: '/v.mp4', model: 'base' })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/binary not found/i)
  })

  it('extrahiert Audio, spawnt whisper, parst Segmente aus stdout', async () => {
    const proc = makeFakeProc()
    spawnMock.mockReturnValue(proc)

    const { startTranscription } = await import('../../../src/main/transcriber')
    const progress: number[] = []
    const resultPromise = startTranscription(
      { videoPath: '/v.mp4', model: 'base' },
      (p) => progress.push(p.currentSegment ?? p.percent),
    )

    await tick() // Audio-Extraktion + spawn abwarten
    expect(spawnMock).toHaveBeenCalledWith('/usr/bin/whisper-cli', [
      '-m', '/models/ggml-base.bin', '-f', '/tmp/a.wav', '-l', 'auto',
    ])

    proc.stdout.emit('data', Buffer.from('[00:00:00.000 --> 00:00:02.000]  Hello\n'))
    proc.stdout.emit('data', Buffer.from('[00:00:02.000 --> 00:00:04.000]  World\n'))
    proc.emit('close', 0)

    const res = await resultPromise
    expect(res.success).toBe(true)
    expect(res.segments).toHaveLength(2)
    expect(res.segments![0].text).toBe('Hello')
    expect(res.segments![1].text).toBe('World')
    expect(progress.length).toBeGreaterThan(0)
  })

  it('Fehler bei Whisper-Exit-Code != 0', async () => {
    const proc = makeFakeProc()
    spawnMock.mockReturnValue(proc)
    const { startTranscription } = await import('../../../src/main/transcriber')
    const resultPromise = startTranscription({ videoPath: '/v.mp4', model: 'base' })
    await tick()
    proc.emit('close', 1)
    const res = await resultPromise
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/failed with code 1/i)
  })

  it('error-Event → success false', async () => {
    const proc = makeFakeProc()
    spawnMock.mockReturnValue(proc)
    const { startTranscription } = await import('../../../src/main/transcriber')
    const p = startTranscription({ videoPath: '/v.mp4', model: 'base' })
    await tick()
    proc.emit('error', new Error('spawn ENOENT'))
    const res = await p
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/ENOENT/)
  })

  it('lehnt parallelen Lauf ab (Concurrent-Guard)', async () => {
    const proc = makeFakeProc()
    spawnMock.mockReturnValue(proc)
    const { startTranscription } = await import('../../../src/main/transcriber')
    const p1 = startTranscription({ videoPath: '/v.mp4', model: 'base' })
    await tick() // erster Lauf hat _running gesetzt + gespawnt
    const r2 = await startTranscription({ videoPath: '/v.mp4', model: 'base' })
    expect(r2.success).toBe(false)
    expect(r2.error).toMatch(/already running/i)
    proc.emit('close', 0)
    await p1
  })

  it('lehnt unbekanntes Modell ab (Whitelist gegen Path-Traversal)', async () => {
    const { startTranscription } = await import('../../../src/main/transcriber')
    // @ts-expect-error — bewusst ungueltiger Modellname
    const res = await startTranscription({ videoPath: '/v.mp4', model: 'ggml-../../etc' })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/unknown whisper model/i)
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('cancelTranscription → kill + Cancel-Ergebnis', async () => {
    const proc = makeFakeProc()
    spawnMock.mockReturnValue(proc)
    const { startTranscription, cancelTranscription } = await import('../../../src/main/transcriber')
    const resultPromise = startTranscription({ videoPath: '/v.mp4', model: 'base' })
    await tick()

    cancelTranscription()
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM')
    proc.emit('close', null) // SIGTERM → code null

    const res = await resultPromise
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/cancelled/i)
  })
})
