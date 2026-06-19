/**
 * pathSecurity.ts — Deep Module fuer Path-Validierung im Main-Process.
 *
 * Zentrale Sicherheits-Grenze: alle eingehenden Dateipfade aus IPC oder
 * Protocol-Requests muessen durch dieses Modul laufen bevor sie fuer
 * Dateisystem-Operationen verwendet werden.
 *
 * Kleine Schnittstelle — grosse Implementierungstiefe:
 *   - validateForRead()  — Pfad muss existieren, wird via realpathSync aufgeloest
 *   - validateForWrite() — Pfad muss nicht existieren, Parent-Verzeichnis wird aufgeloest
 *
 * Beide Varianten akzeptieren { allowTmp?: boolean } um Home-only vs. Home+Tmp
 * als Parameter zu steuern statt als separate Funktionen.
 */

import fs from 'fs'
import os from 'os'
import path from 'path'

/** Optionen fuer die Path-Validierung */
export interface PathValidationOptions {
  /** Wenn true: Pfade unter os.tmpdir() sind ebenfalls erlaubt (z.B. Proxy-Videos) */
  allowTmp?: boolean
}

// homeDir und tmpDir einmal kanonisch auflösen — auf macOS ist os.tmpdir()
// ein Symlink (/var → /private/var), realpathSync gibt den echten Pfad zurueck
const homeDir = fs.realpathSync(os.homedir())
const tmpDir = fs.realpathSync(os.tmpdir())

/**
 * Prueft ob ein aufgeloester, kanonischer Pfad innerhalb der erlaubten Verzeichnisse liegt.
 * Verwendet path.sep fuer praefixsicheren Vergleich (verhindert /Users/joachim-evil-Angriff).
 * Erlaubt auch den Basisordner selbst (z.B. direktes Schreiben in os.tmpdir()).
 */
function isAllowedPath(resolved: string, allowTmp: boolean): boolean {
  // path.sep-sicherer Vergleich: Pfad muss mit homeDir + Separator beginnen
  // oder exakt homeDir sein (fuer den Fall dass das Verzeichnis selbst geprueft wird)
  if (resolved === homeDir || resolved.startsWith(homeDir + path.sep)) return true
  // Optional: auch tmpDir erlauben (Proxy-Videos, Thumbnails)
  if (allowTmp && (resolved === tmpDir || resolved.startsWith(tmpDir + path.sep))) return true
  return false
}

/**
 * Validiert einen Lese-Pfad.
 *
 * - Loest den Pfad via fs.realpathSync auf (folgt Symlinks, kanonisiert)
 * - Prueft ob der aufgeloeste Pfad innerhalb homeDir (+ optional tmpDir) liegt
 * - Wirft bei nicht-existentem Pfad, leerem Input oder verbotenem Verzeichnis
 *
 * @param userPath  Vom User stammender Pfad (kann Symlinks / Traversal enthalten)
 * @param opts      { allowTmp: true } um Dateien in os.tmpdir() zu erlauben
 * @returns         Kanonischer absoluter Pfad (Rueckgabewert von realpathSync)
 */
export function validateForRead(userPath: string, opts: PathValidationOptions = {}): string {
  if (!userPath || typeof userPath !== 'string') {
    throw new Error('Ungueltiger Pfad: erwartet einen nicht-leeren String')
  }

  // Symlinks aufloesen und Existenz pruefen
  let resolved: string
  try {
    resolved = fs.realpathSync(userPath)
  } catch {
    throw new Error(`Pfad nicht gefunden: ${userPath}`)
  }

  const { allowTmp = false } = opts

  if (!isAllowedPath(resolved, allowTmp)) {
    throw new Error(
      `Zugriff verweigert: Pfad außerhalb erlaubter Verzeichnisse — ${resolved}`,
    )
  }

  return resolved
}

/**
 * Validiert einen Schreib-Pfad (Ziel-Datei muss noch nicht existieren).
 *
 * Da die Ziel-Datei noch nicht existiert, wird das Parent-Verzeichnis
 * via realpathSync aufgeloest. Dies entspricht dem bisherigen Verhalten
 * in exportManager.ts und ipcHandlers.ts (fix #88, #117).
 *
 * @param userPath  Vom User stammender Schreib-Pfad
 * @param opts      { allowTmp: true } um Schreiben in os.tmpdir() zu erlauben
 * @returns         Kanonischer absoluter Pfad (Parent aufgeloest + Dateiname)
 */
export function validateForWrite(userPath: string, opts: PathValidationOptions = {}): string {
  if (!userPath || typeof userPath !== 'string') {
    throw new Error('Ungueltiger Pfad: erwartet einen nicht-leeren String')
  }

  const parentDir = path.dirname(userPath)
  const fileName = path.basename(userPath)

  // Parent-Verzeichnis muss existieren
  let resolvedParent: string
  try {
    resolvedParent = fs.realpathSync(parentDir)
  } catch {
    throw new Error(`Parent-Verzeichnis nicht gefunden: ${parentDir}`)
  }

  const { allowTmp = false } = opts

  if (!isAllowedPath(resolvedParent, allowTmp)) {
    throw new Error(
      `Zugriff verweigert: Schreib-Pfad außerhalb erlaubter Verzeichnisse — ${resolvedParent}`,
    )
  }

  return path.join(resolvedParent, fileName)
}

export default { validateForRead, validateForWrite }
