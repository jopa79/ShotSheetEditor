// waveformActions.test.ts — Waveform-Flow: extractAudio → generateWaveform → Store.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { installFakeIpc, resetFakeIpc } from '../../helpers/fakeIpc'
import { resetAllStores, setVideoPath, getWaveformPeaks, getWaveformDuration } from '@lib/stores'

describe('waveformActions.generateWaveform', () => {
  beforeEach(() => {
    resetAllStores()
  })

  afterEach(() => {
    resetFakeIpc()
    vi.restoreAllMocks()
  })

  it('extrahiert Audio, berechnet Peaks und schreibt sie in den Store', async () => {
    const audioSpy = vi.fn().mockResolvedValue({ success: true, audioPath: '/tmp/a.wav' })
    const wfSpy = vi.fn().mockResolvedValue({
      success: true,
      data: { peaks: [0, 0.5, 1], sampleRate: 16000, duration: 12 },
    })
    installFakeIpc({ extractAudio: audioSpy, generateWaveform: wfSpy })
    setVideoPath('/home/u/v.mp4')

    const { generateWaveform } = await import('@lib/actions/waveformActions')
    await generateWaveform()

    expect(audioSpy).toHaveBeenCalledWith({ videoPath: '/home/u/v.mp4' })
    expect(wfSpy).toHaveBeenCalledWith({ audioPath: '/tmp/a.wav' })
    expect(getWaveformPeaks()).toEqual([0, 0.5, 1])
    expect(getWaveformDuration()).toBe(12)
  })

  it('bricht ohne Video ab', async () => {
    const audioSpy = vi.fn().mockResolvedValue({ success: true, audioPath: '/tmp/a.wav' })
    installFakeIpc({ extractAudio: audioSpy })

    const { generateWaveform } = await import('@lib/actions/waveformActions')
    await generateWaveform()

    expect(audioSpy).not.toHaveBeenCalled()
    expect(getWaveformPeaks()).toEqual([])
  })

  it('schreibt nichts in den Store wenn die Audio-Extraktion scheitert', async () => {
    installFakeIpc({
      extractAudio: vi.fn().mockResolvedValue({ success: false, error: 'no audio' }),
      generateWaveform: vi.fn(),
    })
    setVideoPath('/home/u/v.mp4')

    const { generateWaveform } = await import('@lib/actions/waveformActions')
    await generateWaveform()

    expect(getWaveformPeaks()).toEqual([])
  })

  it('setzt isGenerating waehrend des Laufs true und danach (finally) false', async () => {
    let release!: () => void
    const audioSpy = vi.fn(
      () => new Promise((r) => { release = () => r({ success: true, audioPath: '/tmp/a.wav' }) }),
    )
    installFakeIpc({
      extractAudio: audioSpy,
      generateWaveform: vi.fn().mockResolvedValue({
        success: true,
        data: { peaks: [1], sampleRate: 16000, duration: 1 },
      }),
    })
    setVideoPath('/home/u/v.mp4')

    const { generateWaveform } = await import('@lib/actions/waveformActions')
    const { getIsGeneratingWaveform } = await import('@lib/stores')

    const p = generateWaveform()
    expect(getIsGeneratingWaveform()).toBe(true)
    release()
    await p
    expect(getIsGeneratingWaveform()).toBe(false)
  })
})
