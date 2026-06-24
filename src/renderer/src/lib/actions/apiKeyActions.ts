// apiKeyActions.ts — Renderer-Aktionen fuer die API-Key-Verwaltung.
// Duenne Wrapper um die IPC-Bridge mit Toast-Feedback.

import * as ipc from '../ipc/bridge'
import { showToast } from './toastManager'
import type { ApiKeyProvider } from '../../../../shared/models'

/** Key verschluesselt speichern. Gibt true bei Erfolg zurueck. */
export async function saveApiKey(provider: ApiKeyProvider, key: string): Promise<boolean> {
  const result = await ipc.setApiKey(provider, key)
  if (result.success) {
    showToast(`${provider} API key saved`, 'success')
    return true
  }
  showToast(`Failed to save key: ${result.error ?? 'Unknown error'}`, 'error')
  return false
}

/** Key entfernen. Gibt true bei Erfolg zurueck. */
export async function removeApiKey(provider: ApiKeyProvider): Promise<boolean> {
  const result = await ipc.deleteApiKey(provider)
  if (result.success) {
    showToast(`${provider} API key removed`, 'info')
    return true
  }
  showToast(`Failed to remove key: ${result.error ?? 'Unknown error'}`, 'error')
  return false
}

/** Pruefen ob fuer den Provider ein Key gesetzt ist. */
export async function checkApiKey(provider: ApiKeyProvider): Promise<boolean> {
  const result = await ipc.hasApiKey(provider)
  return result.success && Boolean(result.hasKey)
}
