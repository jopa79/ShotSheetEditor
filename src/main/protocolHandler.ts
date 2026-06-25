// protocolHandler.ts — Custom Protocol fuer lokale Dateien
// Chromium blockiert file:// von http://localhost (Dev-Mode).
// local-media:// umgeht das, indem der Main-Process als sicherer File-Server dient.

import { protocol, net } from 'electron'
import { pathToFileURL } from 'url'
import { validateForRead } from './pathSecurity'

const SCHEME = 'local-media'

/**
 * Scheme als privilegiert registrieren — MUSS vor app.ready aufgerufen werden.
 * stream: true ist kritisch fuer Video-Playback (Range Requests).
 */
export function registerSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: false,
      },
    },
  ])
}

/**
 * Protocol-Handler registrieren — MUSS nach app.ready aufgerufen werden.
 * Validiert Pfade via pathSecurity-Modul (fix #88, Praefixangriff-Bug).
 * Erlaubt Dateien aus homeDir und tmpDir (Proxy-Videos liegen in tmp).
 */
export function registerProtocolHandler(): void {
  protocol.handle(SCHEME, async (request) => {
    // local-media:///Users/path/to/file.mp4 → /Users/path/to/file.mp4
    // new URL() ist robust auch bei URLs mit Host-Anteil (manuelles slice() waere fragil).
    const decoded = decodeURIComponent(new URL(request.url).pathname)

    // Sicherheits-Check via pathSecurity-Modul:
    // - realpathSync (Symlink-sicher)
    // - path.sep-sicherer Vergleich (verhindert /Users/joachim-evil-Angriff)
    // - home + tmp erlaubt (Proxy-Videos)
    let resolved: string
    try {
      resolved = validateForRead(decoded, { allowTmp: true })
    } catch {
      console.warn(`protocolHandler: Zugriff verweigert — ${decoded}`)
      return new Response('Forbidden: path outside allowed directories', { status: 403 })
    }

    try {
      // pathToFileURL kodiert Leerzeichen/Sonderzeichen korrekt — `file://` + Pfad
      // waere bei Pfaden mit Leerzeichen ("My Video.mp4") eine ungueltige URL.
      return await net.fetch(pathToFileURL(resolved).href)
    } catch (err) {
      console.error(`protocolHandler: net.fetch fehlgeschlagen — ${resolved}:`, err)
      return new Response('Not found', { status: 404 })
    }
  })
}

export default { registerSchemes, registerProtocolHandler }
