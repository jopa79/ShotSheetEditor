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

  /**
   * Handle Open Video button click
   */
  const openVideo = async () => {
    try {
      const result = await IPC.openVideoDialog();
      if (!result || !result.success || !result.path) {
        return; // User cancelled or error
      }

      const filePath = result.path;

      try {
        // Get video metadata
        const meta = await IPC.getVideoMeta(filePath);
        if (!meta || !meta.success) {
          showToast('Failed to read video metadata', 'error');
          return;
        }

        // Load into state
        AppState.setState({
          videoPath: filePath,
          videoMeta: meta,
          scenes: [],
          selectedIndices: [],
          favoriteIndices: [],
          deletedIndices: [],
          currentShotIdx: -1,
          projectPath: null,
          isDirty: true,
        });

        UndoRedo.clear();
        VideoPlayer.loadVideo(filePath);
        showToast('Video loaded successfully', 'success');

        // Auto-detect scenes
        _handleDetectScenes();
      } catch (err) {
        console.error('Toolbar: Failed to load video', err);
        showToast('Failed to load video', 'error');
      }
    } catch (err) {
      console.error('Toolbar: openVideoDialog failed', err);
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
      AppState.setState({ isDetecting: true, detectProgress: 0 });

      const result = await IPC.detectScenes(videoPath, threshold);
      const scenes = result?.scenes || result;

      if (scenes && Array.isArray(scenes)) {
        AppState.setState({
          scenes,
          selectedIndices: [],
          favoriteIndices: [],
          deletedIndices: [],
          currentShotIdx: scenes.length > 0 ? 0 : -1,
        });

        showToast(`Detected ${scenes.length} scenes`, 'success');
      } else {
        showToast('No scenes detected', 'warning');
      }
    } catch (err) {
      console.error('Toolbar: detectScenes failed', err);
      showToast('Scene detection failed', 'error');
    } finally {
      AppState.setState({ isDetecting: false, detectProgress: 0 });
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
   */
  const _handleThresholdCommit = () => {
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
    if (openVideoBtn) {
      openVideoBtn.addEventListener('click', openVideo);
    }

    if (_detectButton) {
      _detectButton.addEventListener('click', _handleDetectScenes);
    }

    // Threshold slider
    if (_thresholdSlider) {
      _thresholdSlider.addEventListener('input', (e) => {
        _handleThresholdInput(e.target.value);
      });
      _thresholdSlider.addEventListener('change', () => {
        _handleThresholdCommit();
      });
      _updateThresholdDisplay();
    }

    // Undo/Redo buttons
    if (_undoButton) {
      _undoButton.addEventListener('click', _handleUndo);
    }
    if (_redoButton) {
      _redoButton.addEventListener('click', _handleRedo);
    }

    // Grid size pill buttons
    const gridSizeGroup = document.querySelector('#gridSizeGroup');
    if (gridSizeGroup) {
      gridSizeGroup.querySelectorAll('[data-size]').forEach((btn) => {
        btn.addEventListener('click', () => {
          AppState.setState({ gridSize: parseInt(btn.dataset.size, 10) });
          gridSizeGroup.querySelectorAll('[data-size]').forEach((b) => {
            b.classList.toggle('active', b === btn);
          });
        });
      });
    }

    // Filter pill buttons
    const filterGroup = document.querySelector('#filterGroup');
    if (filterGroup) {
      filterGroup.querySelectorAll('[data-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          AppState.setState({ filterMode: btn.dataset.filter === 'favs' ? 'favorites' : 'all' });
          filterGroup.querySelectorAll('[data-filter]').forEach((b) => {
            b.classList.toggle('active', b === btn);
          });
        });
      });
    }

    // Export button
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        // Show context menu with export options
        const rect = exportBtn.getBoundingClientRect();
        showContextMenu(
          [
            { label: 'Export Sequence (ProRes/H.264)', action: exportSequence },
            { label: 'Export ZIP (Thumbnails)', action: exportZip },
          ],
          rect.left,
          rect.bottom + 4,
        );
      });
    }

    // Theme toggle button
    if (themeBtn) {
      themeBtn.addEventListener('click', async () => {
        try {
          await IPC.toggleTheme();
        } catch (err) {
          console.error('Toolbar: toggleTheme failed', err);
        }
      });
    }

    // State listeners
    const isDetectingCleanup = AppState.onStateChange?.('isDetecting', (isDetecting) => {
      if (_detectButton) {
        _detectButton.disabled = isDetecting;
        _detectButton.querySelector('span').textContent = isDetecting ? 'Detecting...' : 'Detect Scenes';
      }
    });

    _stateListeners = [isDetectingCleanup].filter(Boolean);

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
  };

  return {
    init,
    cleanup,
    openVideo,
    openProject,
    saveProject,
    saveProjectAs,
    exportSequence,
    exportZip,
  };
})();
