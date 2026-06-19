// themeActions.ts — Theme-Aktionen (Toggle, Load)
// Wrapper um IPC-Aufrufe fuer Theme-Verwaltung

import * as ipc from '../ipc/bridge'
import { showToast } from './toastManager'

/**
 * Theme zwischen hell und dunkel wechseln.
 * Das DOM-Update erfolgt zentral via onThemeChanged-Listener (listeners.ts).
 */
export async function toggleTheme(): Promise<void> {
  try {
    await ipc.toggleTheme()
    // DOM-Update erfolgt zentral via onThemeChanged-Listener (listeners.ts) —
    // hier NICHT doppelt togglen (sonst zwei Schreibpfade auf dieselbe Klasse).
  } catch (err) {
    console.error('themeActions: toggleTheme failed', err)
    showToast('Failed to toggle theme', 'error')
  }
}
