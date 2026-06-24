// apiKeyActions.test.ts — Renderer→IPC-Kontrakt der API-Key-Aktionen.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { installFakeIpc, resetFakeIpc } from '../../helpers/fakeIpc'

describe('apiKeyActions', () => {
  afterEach(() => {
    resetFakeIpc()
    vi.restoreAllMocks()
  })

  it('saveApiKey ruft ipc.setApiKey und meldet Erfolg (true)', async () => {
    const setSpy = vi.fn().mockResolvedValue({ success: true })
    installFakeIpc({ setApiKey: setSpy })
    const { saveApiKey } = await import('@lib/actions/apiKeyActions')

    const ok = await saveApiKey('openai', 'sk-1')
    expect(ok).toBe(true)
    expect(setSpy).toHaveBeenCalledWith('openai', 'sk-1')
  })

  it('saveApiKey gibt false zurueck bei Fehler', async () => {
    installFakeIpc({ setApiKey: vi.fn().mockResolvedValue({ success: false, error: 'no encryption' }) })
    const { saveApiKey } = await import('@lib/actions/apiKeyActions')
    expect(await saveApiKey('anthropic', 'k')).toBe(false)
  })

  it('removeApiKey ruft ipc.deleteApiKey', async () => {
    const delSpy = vi.fn().mockResolvedValue({ success: true })
    installFakeIpc({ deleteApiKey: delSpy })
    const { removeApiKey } = await import('@lib/actions/apiKeyActions')
    await removeApiKey('elevenlabs')
    expect(delSpy).toHaveBeenCalledWith('elevenlabs')
  })

  it('checkApiKey spiegelt hasKey', async () => {
    installFakeIpc({ hasApiKey: vi.fn().mockResolvedValue({ success: true, hasKey: true }) })
    const { checkApiKey } = await import('@lib/actions/apiKeyActions')
    expect(await checkApiKey('openai')).toBe(true)
  })

  it('checkApiKey false wenn success false', async () => {
    installFakeIpc({ hasApiKey: vi.fn().mockResolvedValue({ success: false }) })
    const { checkApiKey } = await import('@lib/actions/apiKeyActions')
    expect(await checkApiKey('openai')).toBe(false)
  })
})
