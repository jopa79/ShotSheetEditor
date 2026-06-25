/**
 * Main Application Module
 * Initializes all renderer modules and sets up IPC listeners
 * Runs on DOMContentLoaded
 */
const App = (() => {
  let _toastContainer = null;
  let _modalContainer = null;
  let _contextMenu = null;
  let _ipcListeners = [];
  // Cleanup-Funktionen für StateChange-Listener in _setupTranscodingUI (#132)
  let _transcodingCleanups = [];

  /**
   * Create toast notification element
   * @param {string} message - Toast message
   * @param {string} type - Toast type: 'success', 'error', 'warning', 'info'
   */
  const _createToastElement = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');

    return toast;
  };

  /**
   * Show toast notification
   * @param {string} message - Message text
   * @param {string} type - Toast type
   */
  const showToast = (message, type = 'info') => {
    if (!_toastContainer) {
      // Use existing container from HTML, or create one as fallback
      _toastContainer = document.getElementById('toastsContainer');
      if (!_toastContainer) {
        _toastContainer = document.createElement('div');
        _toastContainer.id = 'toastsContainer';
        _toastContainer.className = 'toasts-container';
        document.body.appendChild(_toastContainer);
      }
    }

    const toast = _createToastElement(message, type);
    _toastContainer.appendChild(toast);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  };

  /**
   * Show modal dialog
   * @param {string|HTMLElement} content - Modal content
   * @param {object} options - Modal options
   */
  const showModal = (content, options = {}) => {
    if (!_modalContainer) {
      _modalContainer = document.getElementById('modalsContainer');
      if (!_modalContainer) {
        _modalContainer = document.createElement('div');
        _modalContainer.id = 'modalsContainer';
        document.body.appendChild(_modalContainer);
      }
    }

    // Backdrop = äußerstes Fullscreen-Overlay (CSS: position fixed, zentriert)
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    // Modal-Dialog darin zentriert
    const modal = document.createElement('div');
    modal.className = 'modal';

    if (typeof content === 'string') {
      modal.textContent = content;
    } else {
      modal.appendChild(content);
    }

    // Close-Button oben rechts im Dialog
    if (options.closeButton !== false) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'modal-close';
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => {
        backdrop.remove();
      });
      modal.appendChild(closeBtn);
    }

    backdrop.appendChild(modal);

    // Klick auf Backdrop (nicht auf Modal) schließt den Dialog
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop && !options.noBackdropClose) {
        backdrop.remove();
      }
    });

    _modalContainer.appendChild(backdrop);

    return backdrop;
  };

  /**
   * Show context menu at position
   * @param {array} items - Menu items
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  const showContextMenu = (items, x, y) => {
    // Close existing menu
    if (_contextMenu) {
      _contextMenu.remove();
    }

    _contextMenu = document.createElement('div');
    _contextMenu.className = 'ctx-menu';
    _contextMenu.style.left = x + 'px';
    _contextMenu.style.top = y + 'px';

    for (const item of items) {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'ctx-menu-divider';
        _contextMenu.appendChild(sep);
      } else {
        const menuItem = document.createElement('button');
        menuItem.className = 'ctx-menu-item';
        menuItem.textContent = item.label;

        menuItem.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          if (item.action) {
            try {
              item.action();
            } catch (err) {
              console.error('Context menu action failed:', err);
            }
          }

          _contextMenu.remove();
          _contextMenu = null;
        });

        _contextMenu.appendChild(menuItem);
      }
    }

    document.body.appendChild(_contextMenu);

    // Viewport-Begrenzung: Menü darf nicht über den Rand hinausgehen (#163)
    // getBoundingClientRect() funktioniert erst nach dem Append
    const menuRect = _contextMenu.getBoundingClientRect();
    const vpWidth = window.innerWidth;
    const vpHeight = window.innerHeight;
    if (x + menuRect.width > vpWidth) {
      _contextMenu.style.left = Math.max(0, vpWidth - menuRect.width) + 'px';
    }
    if (y + menuRect.height > vpHeight) {
      _contextMenu.style.top = Math.max(0, y - menuRect.height) + 'px';
    }

    // Menü bei Klick ausserhalb schliessen — null-Check nötig, da Item-Handler _contextMenu vorher auf null setzen kann (#89)
    const closeMenu = (e) => {
      if (_contextMenu && !_contextMenu.contains(e.target)) {
        _contextMenu.remove();
        _contextMenu = null;
        document.removeEventListener('click', closeMenu);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 0);
  };

  /**
   * Handle drag and drop file drops — delegiert an Toolbar.openVideoFromPath
   */
  let _dragDropCleanup = null;

  const _setupDragDrop = () => {
    const dragoverHandler = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      document.body.classList.add('drag-over');
    };

    const dragleaveHandler = (e) => {
      // Nur entfernen wenn wir das Fenster wirklich verlassen — nicht bei Kindselement-Wechseln (#85)
      // relatedTarget ist null wenn der Cursor das Fenster verlässt
      if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
        document.body.classList.remove('drag-over');
      }
    };

    const dropHandler = async (e) => {
      e.preventDefault();
      document.body.classList.remove('drag-over');

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const filePath = files[0].path;
        if (filePath) {
          // Dateiendung prüfen bevor der volle Flow gestartet wird
          const ext = '.' + filePath.split('.').pop().toLowerCase();
          // Muss mit SUPPORTED_FORMATS in shared/constants.js synchron gehalten werden (#165)
          const SUPPORTED_FORMATS = ['.mp4', '.mov', '.mkv', '.avi', '.mxf', '.webm'];
          if (!SUPPORTED_FORMATS.includes(ext)) {
            showToast(`Unsupported format. Supported: ${SUPPORTED_FORMATS.join(', ')}`, 'warning');
            return;
          }
          Toolbar.openVideoFromPath(filePath);
        }
      }
    };

    document.addEventListener('dragover', dragoverHandler);
    document.addEventListener('dragleave', dragleaveHandler);
    document.addEventListener('drop', dropHandler);

    _dragDropCleanup = () => {
      document.removeEventListener('dragover', dragoverHandler);
      document.removeEventListener('dragleave', dragleaveHandler);
      document.removeEventListener('drop', dropHandler);
    };
  };

  /**
   * Load and apply theme preference
   */
  const _loadTheme = async () => {
    try {
      const result = await IPC.getTheme?.();
      const theme = result?.theme || 'dark';
      document.documentElement.classList.toggle('light-theme', theme === 'light');
    } catch (err) {
      console.error('App: Failed to load theme', err);
      document.documentElement.classList.remove('light-theme');
    }
  };

  /**
   * Check FFmpeg availability
   */
  const _checkFfmpeg = async () => {
    try {
      const result = await IPC.getVersion?.();
      if (result?.success && result.ffmpeg && !result.ffmpeg.available) {
        showToast(
          'FFmpeg not found. Some features may not work. Please install FFmpeg.',
          'warning',
        );
      }
    } catch (err) {
      console.error('App: FFmpeg check failed', err);
    }
  };

  /**
   * Progress-Overlay für Transcoding steuern
   */
  const _setupTranscodingUI = () => {
    const overlay = document.querySelector('#progressOverlay');
    const title = document.querySelector('#progressTitle');
    const barFill = document.querySelector('#progressBarFill');
    const text = document.querySelector('#progressText');
    const cancelBtn = document.querySelector('#btnCancelProgress');

    // Cancel-Button: Proxy-Transcoding abbrechen
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        if (AppState.get('isTranscoding')) {
          await IPC.cancelProxy();
          AppState.setState({ isTranscoding: false, transcodeProgress: 0 });
          showToast('Transcoding abgebrochen', 'info');
        }
      });
    }

    // Overlay ein/ausblenden je nach Transcoding-Status — Cleanup speichern (#132)
    const cleanupTranscoding = AppState.onStateChange('isTranscoding', (isTranscoding) => {
      if (!overlay) return;
      if (isTranscoding) {
        if (title) title.textContent = 'Transcoding Proxy...';
        if (barFill) barFill.style.width = '0%';
        if (text) text.textContent = '0%';
        overlay.classList.remove('hidden');
      } else {
        overlay.classList.add('hidden');
      }
    });

    // Fortschrittsbalken aktualisieren — Cleanup speichern (#132)
    const cleanupProgress = AppState.onStateChange('transcodeProgress', (pct) => {
      if (!AppState.get('isTranscoding')) return;
      if (barFill) barFill.style.width = `${pct}%`;
      if (text) text.textContent = `${pct}%`;
    });

    _transcodingCleanups = [cleanupTranscoding, cleanupProgress];
  };

  /**
   * Set up IPC listeners
   */
  const _setupIpcListeners = () => {
    const cleanups = [];

    // Proxy-Progress Listener — progress kommt als {progress: number} Objekt
    const proxyProgressCleanup = IPC.onProxyProgress?.((progress) => {
      const pct = progress?.progress ?? progress;
      AppState.setState({ transcodeProgress: pct });
    });
    if (proxyProgressCleanup) cleanups.push(proxyProgressCleanup);

    // Detect progress listener — neue Szenen progressiv ins Grid anhängen (rt-003)
    const detectProgressCleanup = IPC.onDetectProgress?.((progress) => {
      AppState.setState({
        detectProgress: progress?.progress ?? progress,
        detectingSceneCount: progress?.scenesDetected ?? 0,
      });
      // Neu erkannte Szenen ohne State-Update direkt anhängen (vermeidet Full-Re-Render)
      if (progress?.newScenes && progress.newScenes.length > 0) {
        progress.newScenes.forEach((scene) => {
          ShotGrid.appendScene(scene, scene.index);
        });
        // Thumbnails sofort progressiv extrahieren — nicht auf Detection-Ende warten
        ThumbnailQueue.enqueue(progress.newScenes);
      }
    });
    if (detectProgressCleanup) cleanups.push(detectProgressCleanup);

    // Extract progress listener — einzelne Thumbnails progressiv aktualisieren
    const extractProgressCleanup = IPC.onExtractProgress?.((data) => {
      if (data?.frameResult) {
        ShotGrid.updateThumbnail(data.frameResult.index, data.frameResult.path);
      }
    });
    if (extractProgressCleanup) cleanups.push(extractProgressCleanup);

    // Theme changed listener
    const themeChangedCleanup = IPC.onThemeChanged?.((theme) => {
      document.documentElement.classList.toggle('light-theme', theme === 'light');
    });
    if (themeChangedCleanup) cleanups.push(themeChangedCleanup);

    // Before quit listener — main process asks if we can quit
    const beforeQuitCleanup = IPC.onBeforeQuit?.(async () => {
      if (AppState.get('isDirty')) {
        const result = confirm('You have unsaved changes. Are you sure you want to quit?');
        if (!result) {
          return; // User cancelled — don't call confirmQuit
        }
      }
      // Confirm quit to main process
      await IPC.confirmQuit?.();
    });
    if (beforeQuitCleanup) cleanups.push(beforeQuitCleanup);

    // Menu action listener — action strings match index.js sendMenuAction() calls
    const menuActionCleanup = IPC.onMenuAction?.((action) => {
      switch (action) {
        // File menu
        case 'file:openVideo':
          Toolbar.openVideo?.();
          break;

        case 'file:new':
          // Datenverlust verhindern — ungespeicherte Änderungen abfragen (#131)
          if (AppState.get('isDirty')) {
            const confirmed = confirm('Du hast ungespeicherte Änderungen. Neues Projekt ohne Speichern erstellen?');
            if (!confirmed) break;
          }
          // Video pausieren und entladen bevor State zurückgesetzt wird
          VideoPlayer.pauseAndReset?.();
          AppState.resetState();
          UndoRedo.clear();
          showToast('New project created', 'info');
          break;

        case 'file:open':
          Toolbar.openProject?.();
          break;

        case 'file:save':
          Toolbar.saveProject?.();
          break;

        case 'file:saveAs':
          Toolbar.saveProjectAs?.();
          break;

        // Edit menu
        case 'edit:undo':
          if (UndoRedo.canUndo()) {
            UndoRedo.undo();
          }
          break;

        case 'edit:redo':
          if (UndoRedo.canRedo()) {
            UndoRedo.redo();
          }
          break;

        case 'edit:selectAll':
          SelectionManager.selectAll?.();
          break;

        case 'edit:deselect':
          SelectionManager.deselectAll?.();
          break;

        // View menu
        case 'view:toggleTheme':
          IPC.toggleTheme?.();
          break;

        case 'view:zoomIn':
          ShotGrid.zoomIn?.();
          break;

        case 'view:zoomOut':
          ShotGrid.zoomOut?.();
          break;

        case 'view:zoomReset':
          ShotGrid.zoomReset?.();
          break;

        // Export menu
        case 'export:sequence':
          Toolbar.exportSequence?.();
          break;

        case 'export:zip':
          Toolbar.exportZip?.();
          break;

        default:
          console.warn('App: Unknown menu action:', action);
      }
    });
    if (menuActionCleanup) cleanups.push(menuActionCleanup);

    _ipcListeners = cleanups;
  };

  /**
   * Initialize application
   */
  const init = () => {
    // Load theme
    _loadTheme();

    // Initialize modules in order
    try {
      VideoPlayer.init();
      ShotGrid.init();
      SelectionManager.init();
      Toolbar.init();
      Shortcuts.init();
      InfoPanel.init();

    } catch (err) {
      console.error('App: Module initialization failed', err);
      showToast('Application initialization failed', 'error');
      return;
    }

    // Set up drag and drop
    _setupDragDrop();

    // Set up transcoding progress UI
    _setupTranscodingUI();

    // Set up IPC listeners
    _setupIpcListeners();

    // Check FFmpeg availability
    _checkFfmpeg();

    // Set window title
    document.title = 'ShotSheetEditor';

  };

  /**
   * Cleanup application
   */
  const cleanup = () => {
    VideoPlayer.cleanup();
    ShotGrid.cleanup();
    SelectionManager.cleanup();
    Toolbar.cleanup();
    Shortcuts.cleanup();
    InfoPanel.cleanup();

    // Cleanup drag & drop listeners
    if (_dragDropCleanup) {
      _dragDropCleanup();
      _dragDropCleanup = null;
    }

    // Cleanup IPC listeners
    _ipcListeners.forEach((fn) => {
      if (fn) fn();
    });
    _ipcListeners = [];

    // Cleanup Transcoding-StateChange-Listener (#132)
    _transcodingCleanups.forEach((fn) => { if (fn) fn(); });
    _transcodingCleanups = [];
  };

  // Make helper functions globally available
  window.showToast = showToast;
  window.showModal = showModal;
  window.showContextMenu = showContextMenu;

  return {
    init,
    cleanup,
  };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// Cleanup on window unload
window.addEventListener('beforeunload', () => {
  App.cleanup();
});
