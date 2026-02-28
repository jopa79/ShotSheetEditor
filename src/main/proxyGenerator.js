const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const ffmpegBridge = require('./ffmpegBridge');
const { PROXY_CONFIG } = require('../shared/constants');

let transcodingProcess = null;

/**
 * Prüft ob ein Video transkodiert werden muss
 * @param {string} codec - Codec-Name aus ffprobe (z.B. "h264", "prores", "hevc")
 * @param {string} filePath - Dateipfad für Container-Erkennung
 * @returns {boolean} true wenn Transcoding nötig
 */
function needsTranscoding(codec, filePath) {
  const codecLower = (codec || '').toLowerCase();
  const ext = path.extname(filePath).toLowerCase();

  const codecOk = PROXY_CONFIG.BROWSER_COMPATIBLE_CODECS.includes(codecLower);
  const containerOk = PROXY_CONFIG.BROWSER_COMPATIBLE_CONTAINERS.includes(ext);

  return !codecOk || !containerOk;
}

/**
 * Erzeugt einen stabilen Dateinamen für den Proxy basierend auf dem Original-Pfad
 * @param {string} inputPath - Original-Videopfad
 * @returns {string} MD5-basierter Proxy-Dateiname
 */
function _getProxyFileName(inputPath) {
  const hash = crypto.createHash('md5').update(inputPath).digest('hex');
  return `${hash}.mp4`;
}

/**
 * Gibt den Pfad zum Proxy-Verzeichnis zurück, erstellt es falls nötig
 * @returns {string} Pfad zum Proxy-Verzeichnis
 */
function _getProxyDir() {
  const proxyDir = path.join(os.tmpdir(), PROXY_CONFIG.TEMP_DIR_NAME);
  fs.mkdirSync(proxyDir, { recursive: true });
  return proxyDir;
}

/**
 * Prüft ob bereits ein Proxy für dieses Video existiert
 * @param {string} inputPath - Original-Videopfad
 * @returns {string|null} Pfad zum existierenden Proxy oder null
 */
function getExistingProxy(inputPath) {
  const proxyDir = path.join(os.tmpdir(), PROXY_CONFIG.TEMP_DIR_NAME);
  const proxyPath = path.join(proxyDir, _getProxyFileName(inputPath));

  try {
    const stats = fs.statSync(proxyPath);
    if (stats.size > 0) {
      return proxyPath;
    }
    // Leere Datei aufräumen (abgebrochenes Transcoding)
    fs.unlinkSync(proxyPath);
  } catch {
    // Datei existiert nicht oder nicht lesbar
  }

  return null;
}

/**
 * Transkodiert ein Video zu einem Browser-kompatiblen H.264 Proxy
 * @param {string} inputPath - Pfad zum Original-Video
 * @param {number} duration - Video-Dauer in Sekunden (für Progress-Berechnung)
 * @param {function} onProgress - Callback mit {progress: 0-100}
 * @returns {Promise<{success: boolean, proxyPath?: string, error?: string}>}
 */
function generateProxy(inputPath, duration, onProgress) {
  return new Promise((resolve) => {
    const ffmpegPath = ffmpegBridge.getFFmpegPath();
    if (!ffmpegPath) {
      resolve({ success: false, error: 'FFmpeg nicht gefunden' });
      return;
    }

    // Prüfen ob Proxy bereits existiert
    const existingProxy = getExistingProxy(inputPath);
    if (existingProxy) {
      resolve({ success: true, proxyPath: existingProxy, cached: true });
      return;
    }

    const proxyDir = _getProxyDir();
    const outputPath = path.join(proxyDir, _getProxyFileName(inputPath));

    const args = [
      '-i', inputPath,
      '-vf', PROXY_CONFIG.VIDEO_FILTER,
      '-c:v', 'libx264',
      '-pix_fmt', PROXY_CONFIG.PIX_FMT,
      '-preset', PROXY_CONFIG.PRESET,
      '-crf', PROXY_CONFIG.CRF,
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ];

    const proc = spawn(ffmpegPath, args);
    transcodingProcess = proc;

    // Nur letzten Chunk-Rest aufbewahren für Grenzfälle (nicht den gesamten stderr)
    let chunkTail = '';

    proc.stderr.on('data', (data) => {
      const chunk = chunkTail + data.toString();

      // Progress aus time=HH:MM:SS.xx parsen
      if (duration > 0 && onProgress) {
        const timeMatch = chunk.match(/time=(\d+):(\d+):([\d.]+)/g);
        if (timeMatch) {
          const lastMatch = timeMatch[timeMatch.length - 1];
          const parts = lastMatch.match(/time=(\d+):(\d+):([\d.]+)/);
          if (parts) {
            const hours = parseInt(parts[1]);
            const minutes = parseInt(parts[2]);
            const seconds = parseFloat(parts[3]);
            const currentTime = hours * 3600 + minutes * 60 + seconds;
            const progress = Math.min((currentTime / duration) * 100, 99);
            onProgress({ progress: Math.round(progress) });
          }
        }
      }

      // Letzten Teil aufheben für Chunk-Grenzfälle
      chunkTail = chunk.slice(-100);
    });

    proc.on('close', (code) => {
      // Nur nullen wenn dieser Prozess noch der aktuelle ist (Race-Condition-Schutz)
      if (transcodingProcess === proc) {
        transcodingProcess = null;
      }

      if (code === 0) {
        // Prüfen ob Ausgabedatei existiert und nicht leer ist
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          resolve({ success: true, proxyPath: outputPath });
        } else {
          resolve({ success: false, error: 'Proxy-Datei ist leer oder fehlt' });
        }
      } else {
        // Unvollständige Proxy-Datei aufräumen
        _cleanupFile(outputPath);
        resolve({
          success: false,
          error: code === null ? 'Transcoding abgebrochen' : `FFmpeg Fehler (Code ${code})`,
        });
      }
    });

    proc.on('error', (error) => {
      if (transcodingProcess === proc) {
        transcodingProcess = null;
      }
      _cleanupFile(outputPath);
      resolve({ success: false, error: `FFmpeg Fehler: ${error.message}` });
    });
  });
}

/**
 * Bricht ein laufendes Transcoding ab
 */
function cancelTranscoding() {
  const proc = transcodingProcess;
  transcodingProcess = null;
  if (proc) {
    try {
      proc.kill('SIGTERM');
    } catch (error) {
      console.error('Fehler beim Abbrechen des Transcodings:', error);
    }
  }
}

/**
 * Räumt alle Proxy-Dateien auf (bei App-Quit)
 */
function cleanupProxies() {
  const proxyDir = path.join(os.tmpdir(), PROXY_CONFIG.TEMP_DIR_NAME);
  try {
    fs.rmSync(proxyDir, { recursive: true, force: true });
  } catch (error) {
    console.error('Fehler beim Aufräumen der Proxies:', error);
  }
}

/**
 * Löscht eine einzelne Datei ohne Fehler zu werfen
 * @param {string} filePath - Zu löschende Datei
 */
function _cleanupFile(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Fehler beim Löschen:', filePath, error);
    }
  }
}

module.exports = {
  needsTranscoding,
  generateProxy,
  cancelTranscoding,
  cleanupProxies,
  getExistingProxy,
};
