// fileUrl.ts — Konvertiert lokale Dateipfade in local-media:// URLs
// Notwendig weil Chromium file:// von http://localhost blockiert (Dev-Mode).

/**
 * Lokalen Dateipfad in eine local-media:// URL konvertieren.
 * Sonderzeichen in Pfad-Segmenten werden korrekt kodiert.
 */
export function toLocalMediaUrl(filePath: string): string {
  // Pfad-Segmente einzeln kodieren, Slashes beibehalten
  const encoded = filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return 'local-media://' + encoded
}
