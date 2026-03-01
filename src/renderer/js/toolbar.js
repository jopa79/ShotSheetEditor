/**
 * Toolbar Module
 * Handles toolbar UI interactions: video loading, detection, filtering, grid sizing, export
 *
 * HTML element IDs (from index.html):
 *   #btnOpenVideo, #btnDetectScenes, #thresholdSlider, #thresholdValue,
 *   #btnUndo, #btnRedo, #gridSizeGroup [data-size], #filterGroup [data-filter],
 *   #btnExport, #btnTheme
 */
const Toolbar = (() => {
  let _thresholdSlider = null;
  let _thresholdValueEl = null;
  let _detectButton = null;
  let _undoButton = null;
  let _redoButton = null;
  let _stateListeners = [];
  let _boundListeners = [];

  /**
   * Track a DOM event listener for cleanup
   */
  const _addTrackedListener = (el, type, handler) => {
    if (!el) return;
    el.addEventListener(type, handler);
    _boundListeners.push({ el, type, handler });
  };

  /**
   * Handle Open Video button click — öffnet Dialog, delegiert an openVideoFromPath
   */
  const openVideo = async () => {
    try {
      const result = await IPC.openVideoDialog();
      if (!result || !result.success || !result.path) {
        return;
      }
      await openVideoFromPath(result.path);
    } catch (err) {
      console.error('Toolbar: openVideoDialog failed', err);
    }
  };

  /**
   * Generiert einen Proxy und lädt ihn im Player
   * @param {string} filePath - Original-Videopfad
   * @param {number} duration - Video-Dauer in Sekunden
   */
  const _generateAndLoadProxy = async (filePath, duration) => {
    // Vorheriges Video stoppen bevor Transcoding startet (Fix #147)
    VideoPlayer.pauseAndReset?.();
    AppState.setState({ isTranscoding: true, transcodeProgress: 0 });

    const result = await IPC.generateProxy(filePath, duration);

    // Prüfen ob zwischenzeitlich ein anderes Video geöffnet wurde
    if (AppState.get('videoPath') !== filePath) {
      AppState.setState({ isTranscoding: false, transcodeProgress: 0 });
      return;
    }

    AppState.setState({ isTranscoding: false, transcodeProgress: 0 });

    if (result && result.success) {
      await VideoPlayer.loadVideo(result.proxyPath);
      const cached = result.cached ? ' (cached)' : '';
      showToast(`Proxy loaded${cached}`, 'success');
    } else {
      const errorMsg = result?.error || 'Transcoding failed';
      showToast(errorMsg, 'error');
    }
  };

  /**
   * Lädt ein Video: Metadaten holen, Codec prüfen, ggf. Proxy generieren
   * Wird von openVideo() und Drag & Drop aufgerufen
   * @param {string} filePath - Absoluter Pfad zum Video
   */
  const openVideoFromPath = async (filePath) => {
    try {
      // Laufendes Transcoding abbrechen wenn neues Video geöffnet wird
      if (AppState.get('isTranscoding')) {
        await IPC.cancelProxy();
        AppState.setState({ isTranscoding: false, transcodeProgress: 0 });
      }

      // Metadaten abrufen
      const meta = await IPC.getVideoMeta(filePath);
      if (!meta || !meta.success) {
        showToast('Failed to read video metadata', 'error');
        return;
      }

      // Fallback-Projektverzeichnis: Video-Verzeichnis wenn kein Projekt geladen
      const videoDir = filePath.substring(0, filePath.lastIndexOf('/')) || filePath.substring(0, filePath.lastIndexOf('\\'));

      // State zurücksetzen für neues Video
      AppState.setState({
        videoPath: filePath,
        videoMeta: meta,
        scenes: [],
        selectedIndices: [],
        favoriteIndices: [],
        deletedIndices: [],
        currentShotIdx: -1,
        projectPath: videoDir,
        isDirty: true,
      });
      UndoRedo.clear();

      // Codec-Check: Main-Prozess entscheidet ob Proxy nötig ist
      const duration = meta.data?.duration || 0;

      // Guard: Prüfen ob zwischenzeitlich ein anderes Video geöffnet wurde (Fix #125)
      if (AppState.get('videoPath') !== filePath) return;

      if (!meta.data?.needsProxy) {
        try {
          await VideoPlayer.loadVideo(filePath);
          // Guard nochmal prüfen nach await (Fix #125)
          if (AppState.get('videoPath') !== filePath) return;
          showToast('Video loaded successfully', 'success');
          return;
        } catch (loadErr) {
          // Chromium kann das Video trotz kompatiblem Codec nicht abspielen
          // (z.B. Unsupported pixel format) → Fallback auf Proxy
          console.warn('Toolbar: Direct load failed, falling back to proxy:', loadErr.message);
        }
      }

      // Guard vor Proxy-Start (Fix #125)
      if (AppState.get('videoPath') !== filePath) return;

      // Proxy nötig → Transcoding starten
      await _generateAndLoadProxy(filePath, duration);
    } catch (err) {
      console.error('Toolbar: Failed to load video', err);
      AppState.setState({ isTranscoding: false, transcodeProgress: 0 });
      showToast('Failed to load video', 'error');
    }
  };

  /**
   * Handle Detect Scenes button click
   */
  const _handleDetectScenes = async () => {
    const videoPath = AppState.get('videoPath');
    if (!videoPath) {
      showToast('No video loaded', 'warning');
      return;
    }

    const threshold = AppState.get('threshold');

    try {
      // VOR Detection: Szenen und Selektionen leeren — Grid zeigt sofort Empty State (rt-007)
      AppState.setState({
        isDetecting: true,
        detectProgress: 0,
        detectingSceneCount: 0,
        scenes: [],
        selectedIndices: [],
        favoriteIndices: [],
        deletedIndices: [],
        collections: [],
        activeCollectionId: null,
        currentShotIdx: -1,
      });
      UndoRedo.clear();

      const result = await IPC.detectScenes(videoPath, threshold);
      const scenes = result?.scenes || result;

      if (scenes && Array.isArray(scenes)) {
        // NACH Detection: finalen State setzen — triggert einmalig renderGrid() zur Synchronisation (rt-007)
        AppState.setState({
          scenes,
          currentShotIdx: scenes.length > 0 ? 0 : -1,
          isDirty: true, // Scene Detection macht Projekt dirty (Fix #98/#130)
        });

        showToast(`Detected ${scenes.length} scenes`, 'success');

        // Thumbnails extrahieren nachdem Szenen im State gesetzt sind
        if (scenes.length > 0) {
          VideoPlayer.extractThumbs();
        }
      } else {
        showToast('No scenes detected', 'warning');
      }
    } catch (err) {
      console.error('Toolbar: detectScenes failed', err);
      showToast('Scene detection failed', 'error');
    } finally {
      AppState.setState({ isDetecting: false, detectProgress: 0, detectingSceneCount: 0 });
    }
  };

  /**
   * Handle Threshold slider input (live update display)
   */
  const _handleThresholdInput = (value) => {
    const threshold = parseFloat(value) || 0.3;
    AppState.setState({ threshold });
    _updateThresholdDisplay(threshold);
  };

  /**
   * Handle Threshold slider release (commit & re-detect)
   * Fix #126: Guard verhindert Re-Detect während Detection bereits läuft
   */
  const _handleThresholdCommit = () => {
    if (AppState.get('isDetecting')) return; // Guard: kein Re-Detect während Detection läuft
    if (AppState.get('videoPath') && AppState.get('scenes')?.length > 0) {
      _handleDetectScenes();
    }
  };

  /**
   * Update threshold display text
   */
  const _updateThresholdDisplay = (value) => {
    if (_thresholdValueEl) {
      const v = value ?? parseFloat(_thresholdSlider?.value) ?? 0.3;
      _thresholdValueEl.textContent = v.toFixed(2);
    }

    // Also update statusbar threshold
    const statusThreshold = document.querySelector('#statusThreshold');
    if (statusThreshold) {
      const v = value ?? parseFloat(_thresholdSlider?.value) ?? 0.3;
      statusThreshold.textContent = v.toFixed(2);
    }
  };

  /**
   * Handle Undo button click
   */
  const _handleUndo = () => {
    if (UndoRedo.canUndo()) {
      UndoRedo.undo();
      _updateUndoRedoButtons();
    }
  };

  /**
   * Handle Redo button click
   */
  const _handleRedo = () => {
    if (UndoRedo.canRedo()) {
      UndoRedo.redo();
      _updateUndoRedoButtons();
    }
  };

  /**
   * Update undo/redo button states
   */
  const _updateUndoRedoButtons = () => {
    if (_undoButton) {
      _undoButton.disabled = !UndoRedo.canUndo();
    }
    if (_redoButton) {
      _redoButton.disabled = !UndoRedo.canRedo();
    }
  };

  /**
   * Handle Export Sequence
   */
  const exportSequence = async () => {
    const videoPath = AppState.get('videoPath');
    if (!videoPath) {
      showToast('No video loaded', 'warning');
      return;
    }

    // TODO: implement sequence export dialog with codec selection
    showToast('Export Sequence — coming soon', 'info');
  };

  /**
   * Handle Export ZIP
   */
  const exportZip = async () => {
    const scenes = AppState.get('scenes');
    if (!scenes || scenes.length === 0) {
      showToast('No scenes to export', 'warning');
      return;
    }

    // TODO: implement ZIP export
    showToast('Export ZIP — coming soon', 'info');
  };

  /**
   * Handle Save Project
   */
  const saveProject = async () => {
    const videoPath = AppState.get('videoPath');
    const projectPath = AppState.get('projectPath');
    if (!videoPath || !projectPath) {
      showToast('No project to save', 'warning');
      return;
    }

    try {
      const data = {
        videoPath,
        scenes: AppState.get('scenes'),
        favoriteIndices: AppState.get('favoriteIndices'),
        deletedIndices: AppState.get('deletedIndices'),
        collections: AppState.get('collections'),
        settings: {
          threshold: AppState.get('threshold'),
          gridSize: AppState.get('gridSize'),
        },
        modifiedAt: new Date().toISOString(),
      };

      const result = await IPC.saveProject(projectPath, data);
      if (result && result.success) {
        AppState.setState({ isDirty: false });
        showToast('Project saved', 'success');
      } else {
        showToast(result?.error || 'Failed to save project', 'error');
      }
    } catch (err) {
      console.error('Toolbar: saveProject failed', err);
      showToast('Failed to save project', 'error');
    }
  };

  /**
   * Handle Save As
   */
  const saveProjectAs = async () => {
    // TODO: implement save as dialog
    showToast('Save As — coming soon', 'info');
  };

  /**
   * Handle Open Project
   */
  const openProject = async () => {
    // TODO: implement open project dialog
    showToast('Open Project — coming soon', 'info');
  };

  /**
   * Initialize module
   */
  const init = () => {
    // Get toolbar elements by ID (matching index.html)
    const openVideoBtn = document.querySelector('#btnOpenVideo');
    _detectButton = document.querySelector('#btnDetectScenes');
    _thresholdSlider = document.querySelector('#thresholdSlider');
    _thresholdValueEl = document.querySelector('#thresholdValue');
    _undoButton = document.querySelector('#btnUndo');
    _redoButton = document.querySelector('#btnRedo');
    const exportBtn = document.querySelector('#btnExport');
    const themeBtn = document.querySelector('#btnTheme');

    // Bind click handlers
    _addTrackedListener(openVideoBtn, 'click', openVideo);
    _addTrackedListener(_detectButton, 'click', _handleDetectScenes);

    // Threshold slider
    if (_thresholdSlider) {
      const onSliderInput = (e) => _handleThresholdInput(e.target.value);
      const onSliderChange = () => _handleThresholdCommit();
      _addTrackedListener(_thresholdSlider, 'input', onSliderInput);
      _addTrackedListener(_thresholdSlider, 'change', onSliderChange);
      _updateThresholdDisplay();
    }

    // Undo/Redo buttons
    _addTrackedListener(_undoButton, 'click', _handleUndo);
    _addTrackedListener(_redoButton, 'click', _handleRedo);

    // Grid size pill buttons
    const gridSizeGroup = document.querySelector('#gridSizeGroup');
    if (gridSizeGroup) {
      const sizeMap = { small: 150, medium: 200, large: 300, xlarge: 400 };
      gridSizeGroup.querySelectorAll('[data-size]').forEach((btn) => {
        const handler = () => {
          AppState.setState({ gridSize: sizeMap[btn.dataset.size] || 200 });
          gridSizeGroup.querySelectorAll('[data-size]').forEach((b) => {
            b.classList.toggle('active', b === btn);
          });
        };
        _addTrackedListener(btn, 'click', handler);
      });
    }

    // Filter-Pills synchronisieren mit filterMode-State (Fix #6e)
    const _syncFilterPills = (group) => {
      const currentMode = AppState.get('filterMode');
      group.querySelectorAll('[data-filter]').forEach((b) => {
        const btnMode = b.dataset.filter === 'favs' ? 'favorites' : 'all';
        b.classList.toggle('active', btnMode === currentMode);
      });
    };

    // Filter pill buttons
    const filterGroup = document.querySelector('#filterGroup');
    if (filterGroup) {
      filterGroup.querySelectorAll('[data-filter]').forEach((btn) => {
        const handler = () => {
          const filterVal = btn.dataset.filter === 'favs' ? 'favorites' : 'all';
          AppState.setState({ filterMode: filterVal });
          _syncFilterPills(filterGroup);
        };
        _addTrackedListener(btn, 'click', handler);
      });

      // State-Listener für externe filterMode-Änderungen (z.B. via V-Shortcut)
      const filterModeCleanup = AppState.onStateChange('filterMode', () => {
        _syncFilterPills(filterGroup);
      });
      _stateListeners.push(filterModeCleanup);
      _syncFilterPills(filterGroup); // Initial sync
    }

    // Export button
    if (exportBtn) {
      const onExportClick = () => {
        const rect = exportBtn.getBoundingClientRect();
        showContextMenu(
          [
            { label: 'Export Sequence (ProRes/H.264)', action: exportSequence },
            { label: 'Export ZIP (Thumbnails)', action: exportZip },
          ],
          rect.left,
          rect.bottom + 4,
        );
      };
      _addTrackedListener(exportBtn, 'click', onExportClick);
    }

    // Theme toggle button
    if (themeBtn) {
      const onThemeClick = async () => {
        try {
          await IPC.toggleTheme();
        } catch (err) {
          console.error('Toolbar: toggleTheme failed', err);
        }
      };
      _addTrackedListener(themeBtn, 'click', onThemeClick);
    }

    // State listener für isDetecting (Button-Zustand)
    const isDetectingCleanup = AppState.onStateChange?.('isDetecting', (isDetecting) => {
      if (_detectButton) {
        _detectButton.disabled = isDetecting;
        _detectButton.querySelector('span').textContent = isDetecting ? 'Detecting...' : 'Detect Scenes';
      }
    });

    // Live-Counter im Button während Detection (rt-004)
    const detectCountCleanup = AppState.onStateChange?.('detectingSceneCount', (count) => {
      if (_detectButton && AppState.get('isDetecting') && count > 0) {
        _detectButton.querySelector('span').textContent = `Detecting... (${count})`;
      }
    });

    // Alle State-Listener sammeln — filterModeCleanup wurde bereits via push() hinzugefügt
    if (isDetectingCleanup) {
      _stateListeners.push(isDetectingCleanup);
    }
    if (detectCountCleanup) {
      _stateListeners.push(detectCountCleanup);
    }

    // Initial states
    _updateUndoRedoButtons();
  };

  /**
   * Cleanup module
   */
  const cleanup = () => {
    _stateListeners.forEach((fn) => {
      if (fn) fn();
    });
    _stateListeners = [];

    for (const { el, type, handler } of _boundListeners) {
      el.removeEventListener(type, handler);
    }
    _boundListeners = [];
  };

  return {
    init,
    cleanup,
    openVideo,
    openVideoFromPath,
    openProject,
    saveProject,
    saveProjectAs,
    exportSequence,
    exportZip,
  };
})();
