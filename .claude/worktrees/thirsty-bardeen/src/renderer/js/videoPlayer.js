/**
 * VideoPlayer Module
 * Handles video playback, seeking, and timecode display
 */
const VideoPlayer = (() => {
  let _videoElement = null;
  let _tcDisplayElement = null;
  let _playButtonElement = null;
  let _stateListeners = [];
  let _timeUpdateRaf = null; // requestAnimationFrame ID für Throttling (Fix #161)

  // Benannte Handler auf Modul-Ebene für sauberes Cleanup (Fix #93)
  let _onTimeUpdate = null;
  let _onPlay = null;
  let _onPause = null;

  /**
   * Video pausieren und Quelle leeren (Fix #147)
   * Verhindert Audio-Überlappung beim Laden eines neuen Videos
   */
  const pauseAndReset = () => {
    if (!_videoElement) return;
    _videoElement.pause();
    _videoElement.src = '';
    _videoElement.load();
  };

  /**
   * Load video file
   * Gibt ein Promise zurück: resolved bei loadedmetadata, rejected bei Fehler.
   * Damit kann der Aufrufer bei Fehler auf Proxy-Transcoding fallbacken.
   * Fix #147: Vorheriges Video wird vor dem Laden pausiert
   * @param {string} filePath - Pfad zur Videodatei
   * @returns {Promise<void>}
   */
  const loadVideo = (filePath) => {
    return new Promise((resolve, reject) => {
      if (!_videoElement) {
        reject(new Error('Video element not found'));
        return;
      }

      // Vorheriges Video pausieren um Audio-Überlappung zu verhindern (Fix #147)
      _videoElement.pause();

      // Convert file path to file:// protocol URL
      let videoUrl = filePath;
      if (!videoUrl.startsWith('file://') && !videoUrl.startsWith('app://')) {
        videoUrl = 'file://' + (filePath.startsWith('/') ? '' : '/') + filePath;
      }

      const onLoaded = () => {
        removeLoadListeners();
        _extractThumbsForScenes();
        resolve();
      };

      const onError = () => {
        removeLoadListeners();
        const err = _videoElement.error;
        console.error('VideoPlayer: loadVideo error', err?.message || 'unknown');
        reject(new Error(err?.message || 'Video konnte nicht geladen werden'));
      };

      // Timeout: Wenn nach 5s weder loadedmetadata noch error kommt,
      // gilt das Video als nicht abspielbar (z.B. Unsupported pixel format)
      const timeout = setTimeout(() => {
        removeLoadListeners();
        console.error('VideoPlayer: loadVideo timeout — vermutlich inkompatibles Format');
        reject(new Error('Video-Load Timeout — Format nicht abspielbar'));
      }, 5000);

      function removeLoadListeners() {
        clearTimeout(timeout);
        _videoElement.removeEventListener('loadedmetadata', onLoaded);
        _videoElement.removeEventListener('error', onError);
      }

      _videoElement.addEventListener('loadedmetadata', onLoaded, { once: true });
      _videoElement.addEventListener('error', onError, { once: true });

      _videoElement.src = videoUrl;
      _videoElement.load();
    });
  };

  /**
   * Extract thumbnails for all scenes via batch extraction,
   * then update scenes with the extracted file paths.
   * Fix #143: Keine direkte Mutation des scenes-Arrays — neue Objekte erstellen
   */
  const _extractThumbsForScenes = async () => {
    const scenes = AppState.get('scenes');
    if (scenes.length === 0) return;

    try {
      const videoPath = AppState.get('videoPath');
      const projectPath = AppState.get('projectPath');
      if (!projectPath) return;

      const outputDir = projectPath + '/thumbnails';

      // Batch extract all frames via the correct IPC channel
      const result = await IPC.extractFrames(videoPath, scenes, outputDir);
      if (!result || !result.success || !result.frames) return;

      // Frame-Map aufbauen für effiziente Lookup (Fix #143)
      const frameMap = new Map();
      for (const frame of result.frames) {
        if (frame && frame.path != null && frame.index != null) {
          frameMap.set(frame.index, frame.path);
        }
      }

      // Neue Scene-Objekte erstellen — keine direkte Mutation (Fix #143)
      const newScenes = scenes.map((scene, idx) => {
        const thumbPath = frameMap.get(idx);
        return thumbPath ? { ...scene, thumbPath } : scene;
      });

      AppState.setState({ scenes: newScenes });
    } catch (err) {
      console.error('VideoPlayer: _extractThumbsForScenes failed', err);
    }
  };

  /**
   * Seek to specific time
   * @param {number} time - Time in seconds
   */
  const seekTo = (time) => {
    if (!_videoElement) return;

    if (Number.isFinite(time)) {
      _videoElement.currentTime = time;
      updateTcDisplay();
    }
  };

  /**
   * Update timecode display
   */
  const updateTcDisplay = () => {
    if (!_tcDisplayElement || !_videoElement) return;

    const current = formatTimecode(_videoElement.currentTime);
    const duration = formatTimecode(_videoElement.duration);
    _tcDisplayElement.textContent = `${current} / ${duration}`;
  };

  /**
   * Navigate to previous shot
   */
  const prevShot = () => {
    const scenes = AppState.getVisibleScenes();
    const currentIdx = AppState.get('currentShotIdx');

    if (scenes.length === 0) return;

    let newIdx = -1;
    for (let i = 0; i < scenes.length; i++) {
      if (scenes[i].originalIdx < currentIdx) {
        newIdx = scenes[i].originalIdx;
      }
    }

    if (newIdx !== -1) {
      AppState.setState({ currentShotIdx: newIdx });
    }
  };

  /**
   * Navigate to next shot
   */
  const nextShot = () => {
    const scenes = AppState.getVisibleScenes();
    const currentIdx = AppState.get('currentShotIdx');

    if (scenes.length === 0) return;

    for (const scene of scenes) {
      if (scene.originalIdx > currentIdx) {
        AppState.setState({ currentShotIdx: scene.originalIdx });
        return;
      }
    }
  };

  /**
   * Toggle play/pause
   */
  const togglePlayPause = () => {
    if (!_videoElement) return;

    if (_videoElement.paused) {
      _videoElement.play().catch((err) => {
        console.error('VideoPlayer: play failed', err);
      });
    } else {
      _videoElement.pause();
    }
  };

  /**
   * Play-Button auf "Pause"-Icon setzen
   */
  const _setButtonToPause = () => {
    if (_playButtonElement) {
      _playButtonElement.textContent = '\u23F8'; // Pause-Symbol
      _playButtonElement.setAttribute('aria-label', 'Pause');
    }
  };

  /**
   * Play-Button auf "Play"-Icon setzen
   */
  const _setButtonToPlay = () => {
    if (_playButtonElement) {
      _playButtonElement.textContent = '\u25B6'; // Play-Symbol
      _playButtonElement.setAttribute('aria-label', 'Play');
    }
  };

  /**
   * Initialize module
   */
  const init = () => {
    _videoElement = document.querySelector('#videoPlayer');
    _tcDisplayElement = document.querySelector('#tcDisplay');
    _playButtonElement = document.querySelector('#btnPlayPause');

    if (!_videoElement) {
      console.error('VideoPlayer: video element not found');
      return;
    }

    // Timecode-Anzeige initialisieren
    if (_tcDisplayElement) {
      updateTcDisplay();
    }

    // Benannte Handler definieren für späteres Cleanup (Fix #93)
    // requestAnimationFrame-Throttling: DOM-Updates max 1x pro Frame (Fix #161)
    _onTimeUpdate = () => {
      if (_timeUpdateRaf) return;
      _timeUpdateRaf = requestAnimationFrame(() => {
        _timeUpdateRaf = null;
        updateTcDisplay();
      });
    };
    _onPlay = _setButtonToPause;
    _onPause = _setButtonToPlay;

    // Listener mit benannten Handlern registrieren (Fix #93)
    _videoElement.addEventListener('timeupdate', _onTimeUpdate);

    if (_playButtonElement) {
      _playButtonElement.addEventListener('click', togglePlayPause);
      _videoElement.addEventListener('play', _onPlay);
      _videoElement.addEventListener('pause', _onPause);
    }

    // State listener for currentShotIdx changes
    const cleanupCurrentIdx = AppState.onStateChange('currentShotIdx', (idx) => {
      if (idx >= 0) {
        const scene = AppState.get('scenes')[idx];
        if (scene) {
          seekTo(scene.startTime);
        }
      }
    });

    // videoPath-Listener entfernt: loadVideo() wird explizit vom Toolbar-Flow aufgerufen,
    // um Doppel-Load zu vermeiden (Proxy-Pfad vs. Original-Pfad)
    _stateListeners = [cleanupCurrentIdx];
  };

  /**
   * Cleanup module — State-Listener und DOM-Listener entfernen (Fix #93)
   */
  const cleanup = () => {
    _stateListeners.forEach((fn) => fn());
    _stateListeners = [];

    // DOM-Listener mit benannten Handlern entfernen (Fix #93)
    if (_videoElement) {
      if (_onTimeUpdate) _videoElement.removeEventListener('timeupdate', _onTimeUpdate);
      if (_onPlay) _videoElement.removeEventListener('play', _onPlay);
      if (_onPause) _videoElement.removeEventListener('pause', _onPause);
    }
    if (_playButtonElement) {
      _playButtonElement.removeEventListener('click', togglePlayPause);
    }

    // Pending RAF abbrechen (Fix #161)
    if (_timeUpdateRaf) {
      cancelAnimationFrame(_timeUpdateRaf);
      _timeUpdateRaf = null;
    }

    // Handler-Referenzen zurücksetzen
    _onTimeUpdate = null;
    _onPlay = null;
    _onPause = null;
  };

  return {
    init,
    cleanup,
    loadVideo,
    pauseAndReset,
    extractThumbs: _extractThumbsForScenes,
    seekTo,
    updateTcDisplay,
    prevShot,
    nextShot,
    togglePlayPause,
  };
})();
