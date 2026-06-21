// autoSaveActions.ts — Automatisches Speichern in regelmaessigen Abstaenden.
//
// Speichert das Projekt still (kein Toast), wenn ungespeicherte Aenderungen
// vorliegen UND ein Projektpfad gesetzt ist. Schuetzt vor Datenverlust.
//
// Hinweis: Die Settings-UI (Aktivieren/Deaktivieren) + project.json-Persistenz
// (settings.autoSave) sind ein separater Task. Hier liegt der Kern-Mechanismus
// mit einem In-Memory-Flag (Default an) und einer stabilen Toggle-API.

import { getIsDirty, getProjectPath, getVideoPath } from '../stores'
import { saveProject } from './projectActions'

/** Auto-Save-Intervall: alle 60 Sekunden pruefen. */
const AUTO_SAVE_INTERVAL_MS = 60_000

// Bewusst Modul-Level und AUSSERHALB von resetAllStores(): die Auto-Save-
// Praeferenz ist eine App-Einstellung, kein Projekt-State — sie soll ein
// File→New ueberleben. (Persistenz/Settings-UI ist ein separater Task.)
let _enabled = true
let _intervalId: ReturnType<typeof setInterval> | null = null
// Verhindert ueberlappende Saves, falls ein Save laenger als das Intervall braucht.
let _saveInFlight = false

/** Ist Auto-Save aktiviert? */
export function isAutoSaveEnabled(): boolean {
  return _enabled
}

/** Auto-Save aktivieren/deaktivieren (fuer eine spaetere Settings-UI). */
export function setAutoSaveEnabled(enabled: boolean): void {
  _enabled = enabled
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
  if (!_enabled || _saveInFlight) return
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
