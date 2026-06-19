/**
 * Tests fuer das pathSecurity-Modul.
 *
 * Prueft Praefixangriffe, Path-Traversal, Symlink-Aufloesung,
 * tmp-Erlaubnis und ENOENT-Verhalten.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { validateForRead, validateForWrite } from '../../../src/main/pathSecurity'

// Temporaeres Verzeichnis fuer Tests innerhalb homeDir
let testDir: string
let symlinkTarget: string
let symlinkPath: string

beforeAll(() => {
  testDir = fs.mkdtempSync(path.join(os.homedir(), '.pathSecurity-test-'))
  // Eine echte Datei anlegen, auf die der Symlink zeigt
  symlinkTarget = path.join(testDir, 'real-file.txt')
  fs.writeFileSync(symlinkTarget, 'test')
  // Symlink anlegen
  symlinkPath = path.join(testDir, 'link-file.txt')
  fs.symlinkSync(symlinkTarget, symlinkPath)
})

afterAll(() => {
  // Aufraumen
  try {
    fs.rmSync(testDir, { recursive: true, force: true })
  } catch {
    // Ignorieren
  }
})

describe('validateForRead', () => {
  it('akzeptiert kanonischen Pfad unter homeDir', () => {
    const filePath = path.join(testDir, 'real-file.txt')
    const result = validateForRead(filePath)
    expect(result).toBe(fs.realpathSync(filePath))
  })

  it('akzeptiert Pfad unter tmpDir wenn allowTmp: true', () => {
    // Echte Datei in tmpdir anlegen
    const tmpFile = path.join(os.tmpdir(), `pathSecurity-test-${Date.now()}.txt`)
    fs.writeFileSync(tmpFile, 'tmp')
    try {
      const result = validateForRead(tmpFile, { allowTmp: true })
      expect(result).toBe(fs.realpathSync(tmpFile))
    } finally {
      fs.unlinkSync(tmpFile)
    }
  })

  it('lehnt Pfad unter tmpDir ab wenn allowTmp: false (default)', () => {
    const tmpFile = path.join(os.tmpdir(), `pathSecurity-test-${Date.now()}.txt`)
    fs.writeFileSync(tmpFile, 'tmp')
    try {
      expect(() => validateForRead(tmpFile)).toThrow(/außerhalb|outside/)
    } finally {
      fs.unlinkSync(tmpFile)
    }
  })

  it('lehnt Path-Traversal ab (../../etc/passwd)', () => {
    // Erzeuge einen Pfad der aus dem homeDir heraus traversiert.
    // Auf macOS gibt path.join testDir + '../../etc/passwd' → /Users/etc/passwd (existiert nicht).
    // Unabhaengig ob ENOENT oder Access-denied: der Pfad darf nie zurueckgegeben werden.
    const evilPath = path.join(testDir, '../../etc/passwd')
    expect(() => validateForRead(evilPath)).toThrow()
  })

  it('lehnt Praefixangriff ab — <homeDir>-evil darf nicht matchen', () => {
    // Kernbug aus protocolHandler.ts:44
    // Ein Pfad wie /Users/joachim-evil/file soll NICHT erlaubt sein,
    // auch wenn homeDir /Users/joachim ist (ohne path.sep-Schutz wuerde startsWith matchen)
    const homeDir = os.homedir()
    // Wir konstruieren einen Pfad mit dem Home-Prefix + Suffix ohne sep
    // Dieser Pfad existiert nicht — testen ob die Validierung VOR realpathSync greift
    // oder ob realpathSync bereits wirft (ENOENT → throw mit klarer Meldung)
    const prefixAttack = homeDir + '-evil' + path.sep + 'file.txt'
    // Entweder ENOENT oder Access-denied — beides ist korrekt; nicht erlaubt darf der Pfad nicht sein
    expect(() => validateForRead(prefixAttack)).toThrow()
  })

  it('lehnt EXISTIERENDEN Pfad ausserhalb der Whitelist ab (beweist Whitelist-Check, nicht ENOENT)', () => {
    // os.tmpdir() existiert real → realpathSync wirft NICHT.
    // Ohne allowTmp MUSS die Whitelist-Logik den Pfad ablehnen (sonst waere der
    // Praefix-/Whitelist-Schutz nur durch ENOENT "bewiesen", was wertlos ist).
    const tmpReal = fs.realpathSync(os.tmpdir())
    expect(() => validateForRead(tmpReal)).toThrow()
    // Gegenprobe: mit allowTmp ist derselbe existierende Pfad erlaubt.
    expect(() => validateForRead(tmpReal, { allowTmp: true })).not.toThrow()
  })

  it('folgt Symlinks via realpathSync und gibt kanonischen Pfad zurueck', () => {
    const result = validateForRead(symlinkPath)
    // Muss den aufgeloesten echten Pfad zurueckgeben, nicht den Symlink-Pfad
    expect(result).toBe(symlinkTarget)
    expect(result).not.toBe(symlinkPath)
  })

  it('wirft bei nicht-existentem Pfad (ENOENT) mit klarer Meldung', () => {
    const nonExistent = path.join(testDir, 'does-not-exist.txt')
    expect(() => validateForRead(nonExistent)).toThrow(/nicht gefunden|not found/i)
  })

  it('wirft bei leerem Pfad', () => {
    expect(() => validateForRead('')).toThrow()
  })
})

describe('validateForWrite', () => {
  it('kanonisiert das Parent-Verzeichnis fuer noch nicht existierende Output-Dateien', () => {
    // Das Verzeichnis existiert (testDir), die Datei noch nicht
    const newFile = path.join(testDir, 'output.mp4')
    const result = validateForWrite(newFile)
    // Muss den vollstaendigen Zielpfad zurueckgeben (Parent aufgeloest + filename)
    expect(result).toBe(path.join(fs.realpathSync(testDir), 'output.mp4'))
  })

  it('lehnt Write-Pfad ausserhalb homeDir ab (nur home, kein tmp)', () => {
    const tmpFile = path.join(os.tmpdir(), 'output.mp4')
    expect(() => validateForWrite(tmpFile)).toThrow(/außerhalb|outside/)
  })

  it('akzeptiert Write-Pfad in tmp wenn allowTmp: true', () => {
    // Tmp-Verzeichnis existiert
    const tmpFile = path.join(os.tmpdir(), `pathSecurity-write-test-${Date.now()}.mp4`)
    const result = validateForWrite(tmpFile, { allowTmp: true })
    expect(result).toBe(path.join(fs.realpathSync(os.tmpdir()), path.basename(tmpFile)))
  })

  it('lehnt Praefixangriff beim Schreiben ab', () => {
    const homeDir = os.homedir()
    const prefixAttack = homeDir + '-evil' + path.sep + 'file.mp4'
    expect(() => validateForWrite(prefixAttack)).toThrow()
  })

  it('wirft wenn Parent-Verzeichnis nicht existiert', () => {
    const nonExistentDir = path.join(testDir, 'non-existent-dir', 'output.mp4')
    expect(() => validateForWrite(nonExistentDir)).toThrow(/nicht gefunden|not found/i)
  })
})
