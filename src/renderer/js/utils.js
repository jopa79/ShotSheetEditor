/**
 * Shared Utility Functions (renderer)
 */

/**
 * Format seconds to HH:MM:SS.FF timecode (30fps)
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted timecode
 */
function formatTimecode(seconds) {
  if (!Number.isFinite(seconds)) {
    return '00:00:00.00';
  }

  const totalFrames = Math.round(seconds * 30); // 30fps
  const frames = totalFrames % 30;
  const totalSeconds = Math.floor(totalFrames / 30);
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
