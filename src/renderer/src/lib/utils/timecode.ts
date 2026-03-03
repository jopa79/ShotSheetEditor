// timecode.ts — Timecode-Formatierung
// Ersetzt V1 utils.js formatTimecode()

/**
 * Sekunden zu HH:MM:SS.FF Timecode formatieren
 * @param seconds — Zeit in Sekunden
 * @param fps — Framerate (Standard: 30fps)
 * @returns Formatierter Timecode-String
 */
export function formatTimecode(seconds: number, fps: number = 30): string {
  if (!Number.isFinite(seconds) || fps <= 0) {
    return '00:00:00.00'
  }

  // fps als ganzzahligen Wert sichern
  const safeFps = Math.round(fps)
  const totalFrames = Math.round(seconds * safeFps)
  const frames = totalFrames % safeFps
  const totalSeconds = Math.floor(totalFrames / safeFps)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  return (
    String(hours).padStart(2, '0') +
    ':' +
    String(minutes).padStart(2, '0') +
    ':' +
    String(secs).padStart(2, '0') +
    '.' +
    String(frames).padStart(2, '0')
  )
}
