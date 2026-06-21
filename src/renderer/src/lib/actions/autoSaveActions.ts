// autoSaveActions.ts — Automatisches Speichern in regelmaessigen Abstaenden.
//
// Speichert das Projekt still (kein Toast), wenn ungespeicherte Aenderungen
// vorliegen UND ein Projektpfad gesetzt ist. Schuetzt vor Datenverlust.
//
// Die Auto-Save-Praeferenz lebt im uiState-Store (reaktiv fuer den Statusbar-
// Toggle, projekt-scoped + in project.json persistiert). Dieses Modul haelt nur
// den Timer + die Tick-Logik und delegiert das enabled-Flag an den Store.

import {
  getIsDirty,
  getProjectPath,
  getVideoPath,
  getAutoSaveEnabled,
  setAutoSaveEnabled as setStoreAutoSaveEnabled,
} from '../stores'
import { saveProject } from './projectActions'

/** Auto-Save-Intervall: alle 60 Sekunden pruefen. */
const AUTO_SAVE_INTERVAL_MS = 60_000

let _intervalId: ReturnType<typeof setInterval> | null = null
// Verhindert ueberlappende Saves, falls ein Save laenger als das Intervall braucht.
let _saveInFlight = false

// Hinweis: Die Auto-Save-Praeferenz lebt jetzt im uiState-Store (reaktiv fuer die
// Statusbar, projekt-scoped + in project.json persistiert). Diese Wrapper bleiben
// als stabile Action-API erhalten und delegieren an den Store.

/** Ist Auto-Save aktiviert? */
export function isAutoSaveEnabled(): boolean {
  return getAutoSaveEnabled()
}

/** Auto-Save aktivieren/deaktivieren. */
export function setAutoSaveEnabled(enabled: boolean): void {
  setStoreAutoSaveEnabled(enabled)
}

/**
 * Ein Auto-Save-Tick. Speichert NUR wenn:
 *  - Auto-Save aktiviert ist
 *  - kein Save bereits laeuft (debounce-artig gegen Ueberlappung)
 *  - ungespeicherte Aenderungen vorliegen (isDirty)
 *  - ein Projektpfad gesetzt ist
 * Speichert still (kein Erfolgs-Toast); Fehler zeigt saveProject() selbst an.
 */
export async function autoSaveTick(): Promise<void> {
  if (!getAutoSaveEnabled() || _saveInFlight) return
  // videoPath mitpruefen: saveProject() bricht ohne videoPath still ab — sonst
  // bliebe isDirty haengen und jeder Tick liefe ins Leere (stilles False-Positive).
  if (!getIsDirty() || !getProjectPath() || !getVideoPath()) return

  _saveInFlight = true
  try {
    await saveProject({ silent: true })
  } finally {
    _saveInFlight = false
  }
}

/**
 * Startet den Auto-Save-Timer. Gibt eine Cleanup-Funktion zurueck
 * (fuer App.svelte $effect — stoppt den Timer beim Teardown).
 * Mehrfachaufruf ist sicher (vorheriger Timer wird ersetzt).
 */
export function setupAutoSave(): () => void {
  if (_intervalId !== null) {
    clearInterval(_intervalId)
  }
  // Timer-ID in der Closure capturen — robust gegen HMR: wird das Modul
  // hot-reloaded, raeumt der alte Cleanup trotzdem genau seinen Timer ab
  // (statt nur auf die zuruckgesetzte Modul-Variable zu zeigen).
  const id = setInterval(() => {
    void autoSaveTick()
  }, AUTO_SAVE_INTERVAL_MS)
  _intervalId = id

  return () => {
    clearInterval(id)
    if (_intervalId === id) _intervalId = null
  }
}
