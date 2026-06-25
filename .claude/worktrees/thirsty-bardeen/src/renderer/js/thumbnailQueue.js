/**
 * thumbnailQueue.js — Queue-basierte progressive Thumbnail-Extraktion
 *
 * Reiht neu erkannte Szenen sofort zur Thumbnail-Extraktion ein,
 * statt auf den Abschluss der gesamten Scene Detection zu warten.
 *
 * Concurrency: Nur ein IPC.extractFrames-Aufruf gleichzeitig.
 * Race-Condition: videoPath wird vor und nach Extraktion geprüft.
 */
const ThumbnailQueue = (() => {
  /** @type {Array} — Szenen die noch extrahiert werden müssen */
  let _queue = [];

  /** @type {Map<number, string>} — gesammelte Ergebnisse (scene.index → thumbPath) */
  let _thumbPathMap = new Map();

  /** @type {boolean} — Flag ob gerade ein Batch läuft */
  let _isProcessing = false;

  /** @type {string|null} — videoPath zum Zeitpunkt des letzten clear() für Race-Condition-Schutz */
  let _currentVideoPath = null;

  /**
   * Queue und Ergebnis-Map zurücksetzen.
   * Muss vor jeder neuen Detection aufgerufen werden.
   */
  const clear = () => {
    _queue = [];
    _thumbPathMap = new Map();
    _isProcessing = false;
    _currentVideoPath = AppState.get('videoPath');
  };

  /**
   * Neue Szenen einreihen und Queue-Verarbeitung starten.
   * @param {Array} scenes — frisch erkannte Szenen mit scene.index, startTime etc.
   */
  const enqueue = (scenes) => {
    if (!scenes || scenes.length === 0) return;
    _queue.push(...scenes);
    if (!_isProcessing) {
      _processQueue();
    }
  };

  /**
   * Gesammelte thumbPath-Map zurückgeben.
   * Für Merge in toolbar.js direkt nach Detection-Abschluss.
   * @returns {Map<number, string>} — keyed by scene.index
   */
  const getThumbPaths = () => _thumbPathMap;

  /**
   * Nächsten Batch aus der Queue extrahieren (intern, rekursiv).
   */
  const _processQueue = async () => {
    if (_queue.length === 0) {
      _isProcessing = false;
      // Falls Detection bereits beendet: ausstehende thumbPaths in State mergen
      if (!AppState.get('isDetecting')) {
        _mergeThumbsIntoState();
      }
      return;
    }

    _isProcessing = true;

    // Race-Condition-Schutz: videoPath vor Extraktion prüfen
    const videoPath = AppState.get('videoPath');
    if (videoPath !== _currentVideoPath) {
      _queue = [];
      _isProcessing = false;
      return;
    }

    const projectPath = AppState.get('projectPath');
    if (!projectPath) {
      _isProcessing = false;
      return;
    }

    // Alle momentan wartenden Szenen als einen Batch nehmen
    const batch = _queue.splice(0, _queue.length);
    const outputDir = projectPath + '/thumbnails';

    try {
      const result = await IPC.extractFrames(videoPath, batch, outputDir);

      // Race-Condition-Schutz: videoPath nach await nochmal prüfen
      if (AppState.get('videoPath') !== _currentVideoPath) {
        _queue = [];
        _isProcessing = false;
        return;
      }

      // Ergebnisse in Map eintragen — keyed by scene.index (nicht Batch-Position)
      if (result?.success && result.frames) {
        for (const frame of result.frames) {
          if (frame?.path != null && frame?.index != null) {
            _thumbPathMap.set(frame.index, frame.path);
          }
        }
      }
    } catch (err) {
      console.error('ThumbnailQueue: Extraktion fehlgeschlagen', err);
    }

    _isProcessing = false;

    if (_queue.length > 0) {
      // Neue Szenen kamen während Batch lief → sofort weiter
      _processQueue();
    } else if (!AppState.get('isDetecting')) {
      // Detection schon beendet → State mit verbleibenden Ergebnissen aktualisieren
      _mergeThumbsIntoState();
    }
  };

  /**
   * Noch nicht im State enthaltene thumbPaths nachträglich einmergen.
   * Wird aufgerufen wenn die Queue nach Detection-Ende leert.
   */
  const _mergeThumbsIntoState = () => {
    if (_thumbPathMap.size === 0) return;
    const scenes = AppState.get('scenes');
    if (!scenes.length) return;

    let changed = false;
    const newScenes = scenes.map((scene) => {
      const tp = _thumbPathMap.get(scene.index);
      if (tp && scene.thumbPath !== tp) {
        changed = true;
        return { ...scene, thumbPath: tp };
      }
      return scene;
    });

    if (changed) {
      AppState.setState({ scenes: newScenes });
    }
  };

  return { clear, enqueue, getThumbPaths };
})();
