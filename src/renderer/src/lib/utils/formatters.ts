// formatters.ts — Formatierungs-Hilfsfunktionen

/**
 * Dateigröße in menschenlesbares Format umrechnen
 * @param bytes — Größe in Bytes
 * @returns Formatierter String (z.B. "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let unitIndex = 0
  let size = bytes

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return unitIndex === 0
    ? `${size} ${units[unitIndex]}`
    : `${size.toFixed(1)} ${units[unitIndex]}`
}
