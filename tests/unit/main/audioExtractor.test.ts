// audioExtractor.test.ts — Backend-Logik der Audio-Extraktion.
// Mockt ffmpegJobManager (kein echter spawn), pathSecurity (pass-through) und fs.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/main/pathSecurity', () => ({
  validateForRead: (p: string) => p,
  validateForWrite: (p: string) => p,
}))

vi.mock('fs', () => ({
  default: { existsSync: () => true, mkdirSync: () => undefined },
  existsSync: () => true,
  mkdirSync: () => undefined,
}))

const { startJobMock } = vi.hoisted(() => ({ startJobMock: vi.fn() }))

vi.mock('../../../src/main/ffmpegJobManager', () => {
  class JobError extends Error {
    kind: string
    constructor(kind: string, msg: string) {
      super(msg)
      this.name = 'JobError'
      this.kind = kind
    }
  }
  return { JobError, startJob: startJobMock }
})

describe('audioExtractor', () => {
  beforeEach(() => {
    startJobMock.mockReset()
    startJobMock.mockImplementation(() => ({ id: 'job', done: Promise.resolve(), kill: vi.fn() }))
  })

  it('baut korrekte ffmpeg-args (16 kHz mono pcm_s16le, kein Video)', async () => {
    const { extractAudio } = await import('../../../src/main/audioExtractor')
    const res = await extractAudio({ videoPath: '/v.mp4', outputPath: '/out/a.wav' })
    expect(res.success).toBe(true)
    expect(res.audioPath).toBe('/out/a.wav')
    const { args, type } = startJobMock.mock.calls[0][0]
    expect(type).toBe('extract')
    expect(args).toEqual([
      '-i', '/v.mp4',
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      '-y',
      '/out/a.wav',
    ])
  })

  it('nutzt eine custom sampleRate', async () => {
    const { extractAudio } = await import('../../../src/main/audioExtractor')
    await extractAudio({ videoPath: '/v.mp4', outputPath: '/out/a.wav', sampleRate: 48000 })
    const { args } = startJobMock.mock.calls[0][0]
    expect(args[args.indexOf('-ar') + 1]).toBe('48000')
  })

  it('erzeugt Default-Output im Temp-Verzeichnis (.wav) ohne outputPath', async () => {
    const { extractAudio } = await import('../../../src/main/audioExtractor')
    const res = await extractAudio({ videoPath: '/v.mp4' })
    expect(res.success).toBe(true)
    expect(res.audioPath).toMatch(/\.wav$/)
    expect(res.audioPath).toContain('shotsheet-audio')
  })

  it('gibt einen Fehler zurueck wenn der Job fehlschlaegt', async () => {
    startJobMock.mockImplementation(() => ({ id: 'job', done: Promise.reject(new Error('boom')), kill: vi.fn() }))
    const { extractAudio } = await import('../../../src/main/audioExtractor')
    const res = await extractAudio({ videoPath: '/v.mp4', outputPath: '/out/a.wav' })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/failed/i)
  })

  it('unterscheidet den Cancel-Fall (JobError kind=cancelled)', async () => {
    const jobMgr = await import('../../../src/main/ffmpegJobManager')
    const CancelError = new (jobMgr.JobError as new (kind: string, msg: string) => Error)('cancelled', 'Job abgebrochen')
    startJobMock.mockImplementation(() => ({ id: 'job', done: Promise.reject(CancelError), kill: vi.fn() }))
    const { extractAudio } = await import('../../../src/main/audioExtractor')
    const res = await extractAudio({ videoPath: '/v.mp4', outputPath: '/out/a.wav' })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/cancelled/i)
  })
})
