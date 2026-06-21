// clipExporter.test.ts — Backend-Logik des Clip-Exports.
// Mockt ffmpegJobManager (kein echter spawn), pathSecurity (pass-through) und fs.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/main/pathSecurity', () => ({
  validateForRead: (p: string) => p,
  validateForWrite: (p: string) => p,
}))

vi.mock('fs', () => ({
  default: { existsSync: () => true },
  existsSync: () => true,
}))

const { startJobMock } = vi.hoisted(() => ({ startJobMock: vi.fn() }))

vi.mock('../../../src/main/ffmpegJobManager', () => {
  class JobError extends Error {
    kind: string
    code?: number
    constructor(kind: string, msg: string, code?: number) {
      super(msg)
      this.name = 'JobError'
      this.kind = kind
      this.code = code
    }
  }
  return { JobError, startJob: startJobMock }
})

describe('clipExporter', () => {
  beforeEach(() => {
    startJobMock.mockReset()
    // Default: Job laeuft sofort erfolgreich durch
    startJobMock.mockImplementation(() => ({ id: 'job', done: Promise.resolve(), kill: vi.fn() }))
  })

  it('Regression: Dateiname hat genau EINEN Punkt + korrekte Extension', async () => {
    const { exportClips } = await import('../../../src/main/clipExporter')
    const res = await exportClips({
      videoPath: '/v.mp4',
      outputDir: '/out',
      codec: 'PRORES',
      clips: [{ startTime: 0, endTime: 5, name: 'Shot 1' }],
    })
    expect(res.success).toBe(true)
    const { args } = startJobMock.mock.calls[0][0]
    const outPath = args[args.length - 1]
    expect(outPath).toBe('/out/Shot_1.mov')
    expect(outPath).not.toContain('..mov')
  })

  it('baut korrekte ffmpeg-args (-ss vor -i, -t duration, output zuletzt)', async () => {
    const { exportClips } = await import('../../../src/main/clipExporter')
    await exportClips({
      videoPath: '/v.mp4',
      outputDir: '/out',
      codec: 'H264',
      clips: [{ startTime: 2, endTime: 7, name: 'a' }],
    })
    const { args, type, duration } = startJobMock.mock.calls[0][0]
    expect(type).toBe('transcode')
    expect(duration).toBe(5)
    expect(args.slice(0, 6)).toEqual(['-ss', '2', '-i', '/v.mp4', '-t', '5'])
    expect(args[args.length - 1]).toBe('/out/a.mp4')
  })

  it('exportiert mehrere Clips sequentiell und gibt die Pfade zurueck', async () => {
    const { exportClips } = await import('../../../src/main/clipExporter')
    const res = await exportClips({
      videoPath: '/v.mp4',
      outputDir: '/out',
      codec: 'H264',
      clips: [
        { startTime: 0, endTime: 5, name: 'a' },
        { startTime: 5, endTime: 10, name: 'b' },
      ],
    })
    expect(res.success).toBe(true)
    expect(res.exportedClips).toEqual(['/out/a.mp4', '/out/b.mp4'])
    expect(startJobMock).toHaveBeenCalledTimes(2)
  })

  it('lehnt ungueltige Zeitbereiche ab (endTime <= startTime)', async () => {
    const { exportClips } = await import('../../../src/main/clipExporter')
    const res = await exportClips({
      videoPath: '/v.mp4',
      outputDir: '/out',
      codec: 'H264',
      clips: [{ startTime: 5, endTime: 5, name: 'bad' }],
    })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/time range/i)
    expect(startJobMock).not.toHaveBeenCalled()
  })

  it('leere Clip-Liste → success false', async () => {
    const { exportClips } = await import('../../../src/main/clipExporter')
    const res = await exportClips({ videoPath: '/v.mp4', outputDir: '/out', codec: 'H264', clips: [] })
    expect(res.success).toBe(false)
  })

  it('gibt bei Job-Fehler die bereits exportierten Clips zurueck', async () => {
    // Erster Clip ok, zweiter wirft
    startJobMock
      .mockImplementationOnce(() => ({ id: 'j1', done: Promise.resolve(), kill: vi.fn() }))
      .mockImplementationOnce(() => ({ id: 'j2', done: Promise.reject(new Error('boom')), kill: vi.fn() }))

    const { exportClips } = await import('../../../src/main/clipExporter')
    const res = await exportClips({
      videoPath: '/v.mp4',
      outputDir: '/out',
      codec: 'H264',
      clips: [
        { startTime: 0, endTime: 5, name: 'a' },
        { startTime: 5, endTime: 10, name: 'b' },
      ],
    })
    expect(res.success).toBe(false)
    expect(res.exportedClips).toEqual(['/out/a.mp4'])
  })
})
