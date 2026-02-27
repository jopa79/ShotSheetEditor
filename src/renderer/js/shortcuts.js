/**
 * Shortcuts Module
 * Handles keyboard shortcuts for common operations
 */
const Shortcuts = (() => {
  let _isInitialized = false;

  /**
   * Check if Cmd/Ctrl key is pressed (platform-aware)
   * @param {KeyboardEvent} event - Keyboard event
   * @returns {boolean}
   */
  const _isCmdCtrl = (event) => {
    return event.ctrlKey || event.metaKey;
  };

  /**
   * Handle keydown event
   */
  const _handleKeydown = (event) => {
    // Check if target is input/textarea (don't intercept in these)
    const target = event.target;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.contentEditable === 'true'
    ) {
      // Allow standard editing shortcuts
      if (!_isCmdCtrl(event) && event.key !== 'Escape') {
        return;
      }
    }

    switch (true) {
      // Cmd/Ctrl+O: Open Video
      case _isCmdCtrl(event) && event.key === 'o':
        event.preventDefault();
        document.querySelector('[data-action="open-video"]')?.click();
        break;

      // Cmd/Ctrl+Z: Undo
      case _isCmdCtrl(event) && event.key === 'z' && !event.shiftKey:
        event.preventDefault();
        if (UndoRedo.canUndo()) {
          UndoRedo.undo();
        }
        break;

      // Cmd/Ctrl+Shift+Z: Redo
      case _isCmdCtrl(event) && event.key === 'z' && event.shiftKey:
        event.preventDefault();
        if (UndoRedo.canRedo()) {
          UndoRedo.redo();
        }
        break;

      // Cmd/Ctrl+A: Select All
      case _isCmdCtrl(event) && event.key === 'a':
        event.preventDefault();
        SelectionManager.selectAll();
        break;

      // Escape: Deselect All
      case event.key === 'Escape':
        event.preventDefault();
        SelectionManager.deselectAll();
        break;

      // Delete/Backspace: Delete Selected
      case event.key === 'Delete' || event.key === 'Backspace':
        event.preventDefault();
        SelectionManager.deleteSelected();
        break;

      // F: Favorite Selected
      case event.key === 'f' || event.key === 'F':
        event.preventDefault();
        const selected = AppState.get('selectedIndices');
        const favorites = AppState.get('favoriteIndices');
        if (selected.length > 0) {
          const allAreFav = selected.every((idx) => favorites.includes(idx));
          if (allAreFav) {
            SelectionManager.unfavSelected();
          } else {
            SelectionManager.favSelected();
          }
        }
        break;

      // Arrow Left: Previous Shot
      case event.key === 'ArrowLeft':
        event.preventDefault();
        VideoPlayer.prevShot();
        break;

      // Arrow Right: Next Shot
      case event.key === 'ArrowRight':
        event.preventDefault();
        VideoPlayer.nextShot();
        break;

      // Space: Play/Pause
      case event.key === ' ':
        event.preventDefault();
        VideoPlayer.togglePlayPause();
        break;

      // 1: Grid Size S (150)
      case event.key === '1':
        event.preventDefault();
        AppState.setState({ gridSize: 150 });
        break;

      // 2: Grid Size M (200)
      case event.key === '2':
        event.preventDefault();
        AppState.setState({ gridSize: 200 });
        break;

      // 3: Grid Size L (300)
      case event.key === '3':
        event.preventDefault();
        AppState.setState({ gridSize: 300 });
        break;

      // 4: Grid Size XL (400)
      case event.key === '4':
        event.preventDefault();
        AppState.setState({ gridSize: 400 });
        break;

      // I: Invert Selection
      case event.key === 'i' || event.key === 'I':
        event.preventDefault();
        SelectionManager.invertSelection();
        break;

      // V: Toggle Filter
      case event.key === 'v' || event.key === 'V':
        event.preventDefault();
        const current = AppState.get('filterMode');
        AppState.setState({
          filterMode: current === 'all' ? 'favorites' : 'all',
        });
        break;

      default:
        break;
    }
  };

  /**
   * Initialize module
   */
  const init = () => {
    if (_isInitialized) return;

    document.addEventListener('keydown', _handleKeydown);
    _isInitialized = true;
  };

  /**
   * Cleanup module
   */
  const cleanup = () => {
    if (!_isInitialized) return;

    document.removeEventListener('keydown', _handleKeydown);
    _isInitialized = false;
  };

  return {
    init,
    cleanup,
  };
})();
