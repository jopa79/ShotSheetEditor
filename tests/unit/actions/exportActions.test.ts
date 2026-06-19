// exportActions.test.ts — Charakterisierungstests für Export-Aktionen
// Benutzt fakeIpc als Test-Seam für window.electronAPI

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { installFakeIpc, resetFakeIpc } from '../../helpers/fakeIpc'
import { resetAllStores, setVideoPath, setScenes, setVideoMeta, setSelectedIndices } from '@lib/stores'

describe('exportActions', () => {
  beforeEach(() => {
    installFakeIpc()
    resetAllStores()
  })

  afterEach(() => {
    resetFakeIpc()
    vi.restoreAllMocks()
  })

  describe('exportSequence', () => {
    it('bricht ab wenn kein Video geladen ist', async () => {
      const { exportSequence } = await import('@lib/actions/exportActions')
      // kein Video im Store → früher Abbruch, kein IPC-Aufruf
      await exportSequence()

      const api = (globalThis as Record<string, unknown>).window as {
        electronAPI: { selectExportDir: ReturnType<typeof vi.fn> }
      }
      expect(api.electronAPI.selectExportDir).not.toHaveBeenCalled()
    })

    it('ruft selectExportDir und dann exportSequence auf wenn Video geladen ist', async () => {
      // Fake-Reaktion: Verzeichnis wurde gewählt
      installFakeIpc({
        selectExportDir: vi.fn().mockResolvedValue({ success: true, path: '/tmp/export' }),
        exportSequence: vi.fn().mockResolvedValue({ success: true }),
      })

      setVideoPath('/videos/test.mp4')
      setVideoMeta({ success: true, data: { codec: 'h264', width: 1920, height: 1080, duration: 30, fps: 25, size: 1000, format: 'mp4', needsProxy: false } })
      setScenes([
        { index: 0, startTime: 0, endTime: 10, duration: 10 },
        { index: 1, startTime: 10, endTime: 20, duration: 10 },
      ])
      // Nur Szene 0 selektiert → endTime muss 10 sein
      setSelectedIndices([0])

      const { exportSequence } = await import('@lib/actions/exportActions')
      await exportSequence()

      const api = (globalThis as Record<string, unknown>).window as {
        electronAPI: {
          selectExportDir: ReturnType<typeof vi.fn>
          exportSequence: ReturnType<typeof vi.fn>
        }
      }
      expect(api.electronAPI.selectExportDir).toHaveBeenCalledTimes(1)
      expect(api.electronAPI.exportSequence).toHaveBeenCalledTimes(1)

      // Argumente prüfen: videoPath, startTime, endTime, outputPath, codec
      const callArgs = api.electronAPI.exportSequence.mock.calls[0][0] as {
        videoPath: string
        startTime: number
        endTime: number
        outputPath: string
        codec: string
      }
      expect(callArgs.videoPath).toBe('/videos/test.mp4')
      expect(callArgs.startTime).toBe(0)
      expect(callArgs.endTime).toBe(10)
      expect(callArgs.codec).toBe('H264')
      expect(callArgs.outputPath).toContain('/tmp/export')
    })

    it('bricht ab wenn Verzeichnis-Dialog abgebrochen wurde', async () => {
      installFakeIpc({
        selectExportDir: vi.fn().mockResolvedValue({ success: false }),
        exportSequence: vi.fn().mockResolvedValue({ success: true }),
      })

      setVideoPath('/videos/test.mp4')
      setVideoMeta({ success: true, data: { codec: 'h264', width: 1920, height: 1080, duration: 30, fps: 25, size: 1000, format: 'mp4', needsProxy: false } })

      const { exportSequence } = await import('@lib/actions/exportActions')
      await exportSequence()

      const api = (globalThis as Record<string, unknown>).window as {
        electronAPI: { exportSequence: ReturnType<typeof vi.fn> }
      }
      // exportSequence IPC darf NICHT aufgerufen worden sein
      expect(api.electronAPI.exportSequence).not.toHaveBeenCalled()
    })
  })

  describe('exportZip', () => {
    it('bricht ab wenn keine Szenen vorhanden sind', async () => {
      const { exportZip } = await import('@lib/actions/exportActions')
      // leerer Szenen-Store
      await exportZip()

      const api = (globalThis as Record<string, unknown>).window as {
        electronAPI: { selectExportDir: ReturnType<typeof vi.fn> }
      }
      expect(api.electronAPI.selectExportDir).not.toHaveBeenCalled()
    })

    it('ruft exportZip IPC mit thumbPaths auf wenn Szenen vorhanden sind', async () => {
      installFakeIpc({
        selectExportDir: vi.fn().mockResolvedValue({ success: true, path: '/tmp/zip-out' }),
        exportZip: vi.fn().mockResolvedValue({ success: true }),
      })

      setVideoPath('/videos/test.mp4')
      setScenes([
        { index: 0, startTime: 0, endTime: 5, duration: 5, thumbPath: '/tmp/thumb0.jpg' },
        { index: 1, startTime: 5, endTime: 10, duration: 5, thumbPath: '/tmp/thumb1.jpg' },
      ])

      const { exportZip } = await import('@lib/actions/exportActions')
      await exportZip()

      const api = (globalThis as Record<string, unknown>).window as {
        electronAPI: {
          exportZip: ReturnType<typeof vi.fn>
        }
      }
      expect(api.electronAPI.exportZip).toHaveBeenCalledTimes(1)

      const callArgs = api.electronAPI.exportZip.mock.calls[0][0] as {
        thumbnailPaths: string[]
        outputPath: string
      }
      expect(callArgs.thumbnailPaths).toEqual(['/tmp/thumb0.jpg', '/tmp/thumb1.jpg'])
      expect(callArgs.outputPath).toContain('/tmp/zip-out')
      expect(callArgs.outputPath).toContain('_thumbnails.zip')
    })
  })
})
