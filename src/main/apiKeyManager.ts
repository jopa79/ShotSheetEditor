// apiKeyManager.ts — Verschluesselte Speicherung von API-Keys via Electron safeStorage.
//
// Keys werden mit dem OS-Schluesselbund (safeStorage) verschluesselt und als
// base64 in userData/apikeys.json abgelegt (Datei-Mode 0600). Niemals im Klartext
// persistiert. getApiKey entschluesselt nur fuer den Aufrufer (Provider-Calls).

import { app, safeStorage } from 'electron'
import fs from 'fs'
import path from 'path'
import type { ApiKeyProvider } from '../shared/models'
import type { ApiKeyGetResponse, ApiKeyHasResponse } from '../shared/ipcPayloads'

const VALID_PROVIDERS: ApiKeyProvider[] = ['openai', 'anthropic', 'elevenlabs']

function _isValidProvider(p: unknown): p is ApiKeyProvider {
  return typeof p === 'string' && (VALID_PROVIDERS as string[]).includes(p)
}

function _storePath(): string {
  return path.join(app.getPath('userData'), 'apikeys.json')
}

/** Verschluesselten Key-Store lesen ({ provider: base64 }). Robust gegen Defekte. */
function _readStore(): Record<string, string> {
  try {
    const parsed = JSON.parse(fs.readFileSync(_storePath(), 'utf-8'))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function _writeStore(store: Record<string, string>): void {
  // Atomic Write (tmp + rename) — verhindert korrupten Store bei Schreibfehler.
  // Mode 0600 — nur der User darf lesen/schreiben.
  const target = _storePath()
  const tmp = `${target}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(store), { mode: 0o600 })
  fs.renameSync(tmp, target)
}

/** API-Key verschluesselt speichern. */
export function setApiKey(provider: ApiKeyProvider, key: string): { success: boolean; error?: string } {
  if (!_isValidProvider(provider)) return { success: false, error: 'Unknown provider' }
  if (typeof key !== 'string' || !key.trim()) return { success: false, error: 'Empty key' }
  if (!safeStorage.isEncryptionAvailable()) {
    return { success: false, error: 'Encryption not available on this system' }
  }
  try {
    const encrypted = safeStorage.encryptString(key)
    const store = _readStore()
    store[provider] = encrypted.toString('base64')
    _writeStore(store)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * API-Key entschluesselt lesen (key undefined wenn keiner gesetzt ist).
 * Hinweis: liefert den Klartext-Key — gedacht fuer Provider-Calls. Idealerweise
 * sollten diese Calls im Main-Process passieren, damit der Key den Main nicht
 * verlaesst; der Renderer nutzt sonst nur hasApiKey() fuer den Status.
 */
export function getApiKey(provider: ApiKeyProvider): ApiKeyGetResponse {
  if (!_isValidProvider(provider)) return { success: false, error: 'Unknown provider' }
  if (!safeStorage.isEncryptionAvailable()) {
    return { success: false, error: 'Encryption not available on this system' }
  }
  try {
    const b64 = _readStore()[provider]
    if (!b64) return { success: true, key: undefined }
    const decrypted = safeStorage.decryptString(Buffer.from(b64, 'base64'))
    return { success: true, key: decrypted }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/** Pruefen ob ein Key gesetzt ist (ohne ihn zu entschluesseln). */
export function hasApiKey(provider: ApiKeyProvider): ApiKeyHasResponse {
  if (!_isValidProvider(provider)) return { success: false, error: 'Unknown provider' }
  try {
    return { success: true, hasKey: Boolean(_readStore()[provider]) }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/** API-Key entfernen. */
export function deleteApiKey(provider: ApiKeyProvider): { success: boolean; error?: string } {
  if (!_isValidProvider(provider)) return { success: false, error: 'Unknown provider' }
  try {
    const store = _readStore()
    delete store[provider]
    _writeStore(store)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export default { setApiKey, getApiKey, hasApiKey, deleteApiKey }
