// autoSaveActions.test.ts — Tests fuer den Auto-Save-Mechanismus.
//
// Prueft die Tick-Bedingungen (enabled/dirty/projectPath/Overlap),
// das stille Speichern (kein Erfolgs-Toast) und den Intervall-Timer.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { installFakeIpc, resetFakeIpc } from '../../helpers/fakeIpc'
import {
  setVideoPath,
  setProjectPath,
  setIsDirty,
  getIsDirty,
  resetAllStores,
} from '@lib/stores'
import * as toastManager from '@lib/actions/toastManager'

let autoSave: typeof import('@lib/actions/autoSaveActions')
let saveSpy: ReturnType<typeof vi.fn>

async function setupWithSaveResult(result: { success: boolean; error?: string }): Promise<void> {
  saveSpy = vi.fn().mockResolvedValue(result)
  installFakeIpc({ saveProject: saveSpy })
  autoSave = await import('@lib/actions/autoSaveActions')
}

describe('autoSaveActions', () => {
  beforeEach(() => {
    resetAllStores()
    // gueltiger Save-Zustand: Video + Projektpfad + dirty
    setVideoPath('/test/video.mp4')
    setProjectPath('/test/project')
    setIsDirty(true)
    // _enabled lebt ausserhalb des Store-Resets → explizit auf Default setzen,
    // damit ein abgebrochener Test keinen Folgetest verseucht.
    autoSave?.setAutoSaveEnabled(true)
  })

  afterEach(() => {
    resetFakeIpc()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('autoSaveTick — Bedingungen', () => {
    it('speichert wenn aktiviert + dirty + projectPath vorhanden', async () => {
      await setupWithSaveResult({ success: true })
      autoSave.setAutoSaveEnabled(true)

      await autoSave.autoSaveTick()

      expect(saveSpy).toHaveBeenCalledOnce()
      expect(getIsDirty()).toBe(false) // saveProject setzt isDirty zurueck
    })

    it('speichert NICHT wenn nicht dirty', async () => {
      await setupWithSaveResult({ success: true })
      setIsDirty(false)

      await autoSave.autoSaveTick()

      expect(saveSpy).not.toHaveBeenCalled()
    })

    it('speichert NICHT ohne projectPath', async () => {
      await setupWithSaveResult({ success: true })
      setProjectPath(null)

      await autoSave.autoSaveTick()

      expect(saveSpy).not.toHaveBeenCalled()
    })

    it('speichert NICHT wenn deaktiviert', async () => {
      await setupWithSaveResult({ success: true })
      autoSave.setAutoSaveEnabled(false)

      await autoSave.autoSaveTick()

      expect(saveSpy).not.toHaveBeenCalled()
      // Reset von _enabled erfolgt zentral in beforeEach.
    })

    it('verhindert ueberlappende Saves (_saveInFlight-Guard)', async () => {
      // saveProject haengt, bis der Test es freigibt → zweiter Tick muss skippen
      let releaseSave!: () => void
      const hangingSave = vi.fn(
        () => new Promise<{ success: boolean }>((r) => { releaseSave = () => r({ success: true }) }),
      )
      installFakeIpc({ saveProject: hangingSave })
      autoSave = await import('@lib/actions/autoSaveActions')
      autoSave.setAutoSaveEnabled(true)

      const first = autoSave.autoSaveTick() // startet Save, haengt
      await Promise.resolve() // Microtask: _saveInFlight ist jetzt true
      const second = autoSave.autoSaveTick() // muss durch den Guard sofort zurueckkehren
      await second

      expect(hangingSave).toHaveBeenCalledOnce() // nur EIN Save trotz zweier Ticks

      releaseSave()
      await first
    })
  })

  describe('stilles Speichern', () => {
    it('zeigt KEINEN Erfolgs-Toast bei Auto-Save', async () => {
      await setupWithSaveResult({ success: true })
      const toastSpy = vi.spyOn(toastManager, 'showToast')
      autoSave.setAutoSaveEnabled(true)

      await autoSave.autoSaveTick()

      expect(saveSpy).toHaveBeenCalledOnce()
      expect(toastSpy).not.toHaveBeenCalled() // kein "Project saved"
    })

    it('zeigt sehr wohl einen Fehler-Toast wenn das Speichern fehlschlaegt', async () => {
      await setupWithSaveResult({ success: false, error: 'disk full' })
      const toastSpy = vi.spyOn(toastManager, 'showToast')
      autoSave.setAutoSaveEnabled(true)

      await autoSave.autoSaveTick()

      expect(toastSpy).toHaveBeenCalledWith('disk full', 'error')
    })
  })

  describe('setupAutoSave — Timer', () => {
    it('feuert einen Tick nach 60s und stoppt nach Cleanup', async () => {
      vi.useFakeTimers()
      await setupWithSaveResult({ success: true })
      autoSave.setAutoSaveEnabled(true)
      setIsDirty(true)

      const cleanup = autoSave.setupAutoSave()

      // Vor 60s: noch nichts
      await vi.advanceTimersByTimeAsync(59_000)
      expect(saveSpy).not.toHaveBeenCalled()

      // Nach 60s: ein Save
      await vi.advanceTimersByTimeAsync(1_000)
      expect(saveSpy).toHaveBeenCalledOnce()

      // Cleanup stoppt den Timer — keine weiteren Saves
      cleanup()
      setIsDirty(true)
      await vi.advanceTimersByTimeAsync(120_000)
      expect(saveSpy).toHaveBeenCalledOnce()
    })
  })
})
