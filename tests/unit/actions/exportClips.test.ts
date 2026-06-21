// exportClips.test.ts — Renderer→IPC-Kontrakt fuer den Clip-Export.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { installFakeIpc, resetFakeIpc } from '../../helpers/fakeIpc'
import { resetAllStores, setVideoPath, setScenes, setSelectedIndices } from '@lib/stores'
import type { Scene } from '@shared/models'

function makeScene(index: number, start: number): Scene {
  return { index, startTime: start, endTime: start + 5, duration: 5 }
}

describe('exportActions.exportClips', () => {
  beforeEach(() => {
    resetAllStores()
  })

  afterEach(() => {
    resetFakeIpc()
    vi.restoreAllMocks()
  })

  it('baut Clips aus den sichtbaren Szenen und ruft ipc.exportClips korrekt', async () => {
    const exportSpy = vi.fn().mockResolvedValue({ success: true, exportedClips: ['/out/a.mov', '/out/b.mov'] })
    installFakeIpc({
      selectExportDir: vi.fn().mockResolvedValue({ success: true, path: '/out' }),
      exportClips: exportSpy,
    })
    setVideoPath('/home/u/myvideo.mp4')
    setScenes([makeScene(0, 0), makeScene(1, 5)])

    const { exportClips } = await import('@lib/actions/exportActions')
    await exportClips('PRORES')

    expect(exportSpy).toHaveBeenCalledOnce()
    const req = exportSpy.mock.calls[0][0] as {
      videoPath: string
      codec: string
      outputDir: string
      clips: { startTime: number; endTime: number; name: string }[]
    }
    expect(req.videoPath).toBe('/home/u/myvideo.mp4')
    expect(req.codec).toBe('PRORES')
    expect(req.outputDir).toBe('/out')
    expect(req.clips).toHaveLength(2)
    expect(req.clips[0]).toMatchObject({ startTime: 0, endTime: 5 })
    expect(req.clips[0].name).toContain('myvideo')
  })

  it('nutzt die selektierten Szenen wenn vorhanden', async () => {
    const exportSpy = vi.fn().mockResolvedValue({ success: true, exportedClips: ['/out/a.mp4'] })
    installFakeIpc({
      selectExportDir: vi.fn().mockResolvedValue({ success: true, path: '/out' }),
      exportClips: exportSpy,
    })
    setVideoPath('/home/u/v.mp4')
    setScenes([makeScene(0, 0), makeScene(1, 5), makeScene(2, 10)])
    setSelectedIndices([2])

    const { exportClips } = await import('@lib/actions/exportActions')
    await exportClips('H264')

    const req = exportSpy.mock.calls[0][0] as { clips: { startTime: number }[] }
    expect(req.clips).toHaveLength(1)
    expect(req.clips[0].startTime).toBe(10)
  })

  it('bricht ohne Video ab (kein Dialog, kein Export)', async () => {
    const dirSpy = vi.fn().mockResolvedValue({ success: true, path: '/out' })
    const exportSpy = vi.fn().mockResolvedValue({ success: true })
    installFakeIpc({ selectExportDir: dirSpy, exportClips: exportSpy })

    const { exportClips } = await import('@lib/actions/exportActions')
    await exportClips('H264')

    expect(dirSpy).not.toHaveBeenCalled()
    expect(exportSpy).not.toHaveBeenCalled()
  })
})
