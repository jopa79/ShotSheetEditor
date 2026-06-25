/**
 * Shared Utility Functions (renderer)
 */

/**
 * Format seconds to HH:MM:SS.FF timecode
 * @param {number} seconds - Zeit in Sekunden
 * @param {number} fps - Framerate (Standard: 30fps)
 * @returns {string} Formatierter Timecode
 */
function formatTimecode(seconds, fps = 30) {
  if (!Number.isFinite(seconds) || fps <= 0) {
    return '00:00:00.00';
  }

  // fps als ganzzahligen Wert sichern
  const safeFps = Math.round(fps);
  const totalFrames = Math.round(seconds * safeFps);
  const frames = totalFrames % safeFps;
  const totalSeconds = Math.floor(totalFrames / safeFps);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  return (
    String(hours).padStart(2, '0') +
    ':' +
    String(minutes).padStart(2, '0') +
    ':' +
    String(secs).padStart(2, '0') +
    '.' +
    String(frames).padStart(2, '0')
  );
}
