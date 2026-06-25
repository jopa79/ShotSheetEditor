// transcriptionActions.test.ts — Renderer→IPC-Kontrakt der Transkription.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { installFakeIpc, resetFakeIpc } from '../../helpers/fakeIpc'
import {
  resetAllStores,
  setVideoPath,
  getTranscriptionSegments,
  getIsTranscribing,
} from '@lib/stores'

describe('transcriptionActions', () => {
  beforeEach(() => {
    resetAllStores()
  })

  afterEach(() => {
    resetFakeIpc()
    vi.restoreAllMocks()
  })

  it('startet die Transkription und schreibt die Segmente in den Store', async () => {
    const segs = [
      { id: 's1', startTime: 0, endTime: 2, text: 'Hallo' },
      { id: 's2', startTime: 2, endTime: 4, text: 'Welt' },
    ]
    const startSpy = vi.fn().mockResolvedValue({ success: true, segments: segs })
    installFakeIpc({ startTranscription: startSpy })
    setVideoPath('/home/u/v.mp4')

    const { startTranscription } = await import('@lib/actions/transcriptionActions')
    await startTranscription('base')

    expect(startSpy).toHaveBeenCalledWith({ videoPath: '/home/u/v.mp4', model: 'base' })
    expect(getTranscriptionSegments()).toEqual(segs)
    expect(getIsTranscribing()).toBe(false) // finally
  })

  it('bricht ohne Video ab', async () => {
    const startSpy = vi.fn()
    installFakeIpc({ startTranscription: startSpy })

    const { startTranscription } = await import('@lib/actions/transcriptionActions')
    await startTranscription('base')

    expect(startSpy).not.toHaveBeenCalled()
  })

  it('isTranscribing bleibt nach Fehler false; keine Segmente', async () => {
    installFakeIpc({
      startTranscription: vi.fn().mockResolvedValue({ success: false, error: 'Whisper binary not found' }),
    })
    setVideoPath('/home/u/v.mp4')

    const { startTranscription } = await import('@lib/actions/transcriptionActions')
    await startTranscription('small')

    expect(getIsTranscribing()).toBe(false)
    expect(getTranscriptionSegments()).toEqual([])
  })

  it('cancelTranscription ruft ipc.cancelTranscription', async () => {
    const cancelSpy = vi.fn().mockResolvedValue({ success: true })
    installFakeIpc({ cancelTranscription: cancelSpy })

    const { cancelTranscription } = await import('@lib/actions/transcriptionActions')
    await cancelTranscription()

    expect(cancelSpy).toHaveBeenCalledOnce()
  })
})
