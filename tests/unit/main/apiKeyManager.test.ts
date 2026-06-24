// apiKeyManager.test.ts — Verschluesselte API-Key-Speicherung.
// Mockt electron (safeStorage + app) und fs (In-Memory-Store).

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: { store: {} as Record<string, string>, available: true },
}))

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  safeStorage: {
    isEncryptionAvailable: () => state.available,
    encryptString: (s: string) => Buffer.from('enc:' + s),
    decryptString: (b: Buffer) => b.toString().replace(/^enc:/, ''),
  },
}))

vi.mock('fs', () => {
  const readFileSync = () => JSON.stringify(state.store)
  // Atomic Write: writeFileSync(tmp) setzt den Store, renameSync(tmp,target) ist Noop
  const writeFileSync = (_p: string, data: string) => {
    state.store = JSON.parse(data)
  }
  const renameSync = () => {}
  return {
    default: { readFileSync, writeFileSync, renameSync },
    readFileSync,
    writeFileSync,
    renameSync,
  }
})

describe('apiKeyManager', () => {
  beforeEach(() => {
    state.store = {}
    state.available = true
  })

  it('set + get Round-Trip; Key wird NICHT im Klartext persistiert', async () => {
    const m = await import('../../../src/main/apiKeyManager')
    expect(m.setApiKey('openai', 'sk-secret-123').success).toBe(true)
    // Im Store steht base64 von "enc:..." — niemals der Klartext-Key
    expect(JSON.stringify(state.store)).not.toContain('sk-secret-123')

    const got = m.getApiKey('openai')
    expect(got.success).toBe(true)
    expect(got.key).toBe('sk-secret-123')
  })

  it('hasApiKey spiegelt den Zustand', async () => {
    const m = await import('../../../src/main/apiKeyManager')
    expect(m.hasApiKey('openai').hasKey).toBe(false)
    m.setApiKey('openai', 'k')
    expect(m.hasApiKey('openai').hasKey).toBe(true)
  })

  it('deleteApiKey entfernt den Key', async () => {
    const m = await import('../../../src/main/apiKeyManager')
    m.setApiKey('anthropic', 'k')
    expect(m.deleteApiKey('anthropic').success).toBe(true)
    expect(m.hasApiKey('anthropic').hasKey).toBe(false)
  })

  it('getApiKey ohne gesetzten Key → success, key undefined', async () => {
    const m = await import('../../../src/main/apiKeyManager')
    const r = m.getApiKey('elevenlabs')
    expect(r.success).toBe(true)
    expect(r.key).toBeUndefined()
  })

  it('lehnt unbekannten Provider ab', async () => {
    const m = await import('../../../src/main/apiKeyManager')
    // @ts-expect-error — bewusst ungueltiger Provider
    expect(m.setApiKey('evil', 'k').success).toBe(false)
    // @ts-expect-error
    expect(m.getApiKey('evil').success).toBe(false)
  })

  it('Fehler wenn Verschluesselung nicht verfuegbar', async () => {
    state.available = false
    const m = await import('../../../src/main/apiKeyManager')
    const r = m.setApiKey('openai', 'k')
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/encryption/i)
  })

  it('lehnt whitespace-only Key ab (kein Speichern)', async () => {
    const m = await import('../../../src/main/apiKeyManager')
    const r = m.setApiKey('openai', '   ')
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/empty/i)
    expect(m.hasApiKey('openai').hasKey).toBe(false)
  })
})
