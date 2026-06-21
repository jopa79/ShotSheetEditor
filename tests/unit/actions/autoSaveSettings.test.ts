// autoSaveSettings.test.ts — Store-Verhalten + project.json-Persistenz der
// Auto-Save-Praeferenz (settings.autoSave).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { installFakeIpc, resetFakeIpc } from '../../helpers/fakeIpc'
import {
  getAutoSaveEnabled,
  setAutoSaveEnabled,
  resetAllStores,
  setVideoPath,
  setProjectPath,
  setIsDirty,
} from '@lib/stores'
import type { ProjectData } from '@shared/models'

describe('Auto-Save Settings — Store + Persistenz', () => {
  beforeEach(() => {
    resetAllStores()
  })

  afterEach(() => {
    resetFakeIpc()
    vi.restoreAllMocks()
  })

  it('Default ist true; resetAllStores setzt auf true zurueck', () => {
    expect(getAutoSaveEnabled()).toBe(true)
    setAutoSaveEnabled(false)
    expect(getAutoSaveEnabled()).toBe(false)
    resetAllStores()
    expect(getAutoSaveEnabled()).toBe(true)
  })

  it('saveProject schreibt settings.autoSave in die Projektdaten', async () => {
    const saveSpy = vi.fn().mockResolvedValue({ success: true })
    installFakeIpc({ saveProject: saveSpy })
    setVideoPath('/v.mp4')
    setProjectPath('/p')
    setAutoSaveEnabled(false)

    const { saveProject } = await import('@lib/actions/projectActions')
    await saveProject()

    expect(saveSpy).toHaveBeenCalledOnce()
    const [path, data] = saveSpy.mock.calls[0] as [string, ProjectData]
    expect(path).toBe('/p')
    expect(data.settings?.autoSave).toBe(false)
  })

  it('openProject uebernimmt settings.autoSave aus den Projektdaten', async () => {
    setIsDirty(false) // kein unsavedChangesDialog
    installFakeIpc({
      openProjectDialog: vi.fn().mockResolvedValue({ success: true, path: '/p' }),
      openProject: vi.fn().mockResolvedValue({ success: true, data: { settings: { autoSave: false } } }),
    })
    expect(getAutoSaveEnabled()).toBe(true)

    const { openProject } = await import('@lib/actions/projectActions')
    await openProject()

    expect(getAutoSaveEnabled()).toBe(false)
  })

  it('openProject defaulted auf true bei fehlenden settings (alte Projekte)', async () => {
    setIsDirty(false)
    setAutoSaveEnabled(false) // vorher false → nach Load muss Default true gelten
    installFakeIpc({
      openProjectDialog: vi.fn().mockResolvedValue({ success: true, path: '/p' }),
      openProject: vi.fn().mockResolvedValue({ success: true, data: {} }),
    })

    const { openProject } = await import('@lib/actions/projectActions')
    await openProject()

    expect(getAutoSaveEnabled()).toBe(true)
  })

  it('newProject setzt Auto-Save auf Default true zurueck (File→New)', async () => {
    setAutoSaveEnabled(false)
    const { newProject } = await import('@lib/actions/projectActions')
    newProject()
    expect(getAutoSaveEnabled()).toBe(true)
  })
})
