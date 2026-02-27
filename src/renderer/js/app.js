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

  /**
   * Create toast notification element
   * @param {string} message - Toast message
   * @param {string} type - Toast type: 'success', 'error', 'warning', 'info'
   */
  const _createToastElement = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
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
      _modalContainer = document.createElement('div');
      _modalContainer.id = 'modalContainer';
      document.body.appendChild(_modalContainer);
    }

    const modal = document.createElement('div');
    modal.className = 'modal';

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.addEventListener('click', () => {
      if (!options.noBackdropClose) {
        modal.remove();
      }
    });

    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';

    if (typeof content === 'string') {
      dialog.textContent = content;
    } else {
      dialog.appendChild(content);
    }

    // Add close button if enabled
    if (options.closeButton !== false) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'modal-close';
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => {
        modal.remove();
      });
      dialog.appendChild(closeBtn);
    }

    modal.appendChild(backdrop);
    modal.appendChild(dialog);
    _modalContainer.appendChild(modal);

    return modal;
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
    _contextMenu.className = 'context-menu';
    _contextMenu.style.left = x + 'px';
    _contextMenu.style.top = y + 'px';

    for (const item of items) {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'context-menu-separator';
        _contextMenu.appendChild(sep);
      } else {
        const menuItem = document.createElement('button');
        menuItem.className = 'context-menu-item';
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

    // Close menu on outside click
    const closeMenu = (e) => {
      if (!_contextMenu.contains(e.target)) {
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
   * Handle drag and drop file drops
   */
  let _dragDropCleanup = null;

  const _setupDragDrop = () => {
    const dragoverHandler = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      document.body.classList.add('drag-over');
    };

    const dragleaveHandler = (e) => {
      if (e.target === document.body) {
        document.body.classList.remove('drag-over');
      }
    };

    const dropHandler = async (e) => {
      e.preventDefault();
      document.body.classList.remove('drag-over');

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        const filePath = file.path;

        // Validate file extension against supported formats
        const ext = '.' + filePath.split('.').pop().toLowerCase();
        const SUPPORTED_FORMATS = ['.mp4', '.mov', '.mkv', '.avi', '.mxf', '.webm'];
        if (!SUPPORTED_FORMATS.includes(ext)) {
          showToast(`Unsupported format. Supported: ${SUPPORTED_FORMATS.join(', ')}`, 'warning');
          return;
        }

        try {
          const meta = await IPC.getVideoMeta(filePath);
          if (meta) {
            AppState.setState({
              videoPath: filePath,
              videoMeta: meta,
              scenes: [],
              selectedIndices: [],
              favoriteIndices: [],
              deletedIndices: [],
              currentShotIdx: -1,
              isDirty: true,
            });

            // VideoPlayer.loadVideo is triggered by onStateChange('videoPath')
            showToast('Video loaded successfully', 'success');
          }
        } catch (err) {
          console.error('Drag drop failed:', err);
          showToast('Failed to load video file', 'error');
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
      document.documentElement.setAttribute('data-theme', theme);
    } catch (err) {
      console.error('App: Failed to load theme', err);
      document.documentElement.setAttribute('data-theme', 'dark');
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
   * Set up IPC listeners
   */
  const _setupIpcListeners = () => {
    const cleanups = [];

    // Detect progress listener
    const detectProgressCleanup = IPC.onDetectProgress?.((progress) => {
      AppState.setState({ detectProgress: progress });
    });
    if (detectProgressCleanup) cleanups.push(detectProgressCleanup);

    // Theme changed listener
    const themeChangedCleanup = IPC.onThemeChanged?.((theme) => {
      document.documentElement.setAttribute('data-theme', theme);
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

      console.log('App: All modules initialized');
    } catch (err) {
      console.error('App: Module initialization failed', err);
      showToast('Application initialization failed', 'error');
      return;
    }

    // Set up drag and drop
    _setupDragDrop();

    // Set up IPC listeners
    _setupIpcListeners();

    // Check FFmpeg availability
    _checkFfmpeg();

    // Set window title
    document.title = 'ShotSheetEditor';

    console.log('App: Initialization complete');
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
