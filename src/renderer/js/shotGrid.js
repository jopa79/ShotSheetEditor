/**
 * ShotGrid Module
 * Renders shot cards in grid with virtual scrolling for performance
 * Handles selection, favorites, and filtering
 */
const ShotGrid = (() => {
  let _gridElement = null;
  let _containerElement = null;
  let _scrollTimeout = null;
  let _stateListeners = [];

  // Virtual scrolling parameters
  let _itemSize = 220; // Approximate height of shot card
  let _bufferSize = 3; // Number of items to buffer above/below viewport
  let _visibleRange = { start: 0, end: 0 };

  /**
   * Calculate visible range based on scroll position
   */
  const _calculateVisibleRange = () => {
    if (!_containerElement) return;

    const scrollTop = _containerElement.scrollTop;
    const containerHeight = _containerElement.clientHeight;
    const scenes = AppState.getVisibleScenes();

    const colCount = Math.max(
      1,
      Math.floor(_gridElement.clientWidth / (AppState.get('gridSize') + 20))
    );
    const start = Math.max(
      0,
      Math.floor((scrollTop / _itemSize) * colCount) - _bufferSize * colCount
    );
    const end = Math.min(
      scenes.length,
      Math.ceil((scrollTop + containerHeight) / _itemSize) * colCount + _bufferSize * colCount
    );

    _visibleRange = { start, end };
  };

  /**
   * Create a shot card element
   * @param {object} scene - Scene data
   * @param {number} idx - Original index in scenes array
   * @returns {HTMLElement} Shot card element
   */
  const _createShotCard = (scene, idx) => {
    const card = document.createElement('div');
    card.className = 'shot-card';
    card.dataset.idx = idx;
    card.dataset.time = scene.startTime;

    const isFavorite = AppState.get('favoriteIndices').includes(idx);
    const isSelected = AppState.get('selectedIndices').includes(idx);
    const isDeleted = AppState.get('deletedIndices').includes(idx);

    card.classList.toggle('favorite', isFavorite);
    card.classList.toggle('selected', isSelected);
    card.classList.toggle('deleted', isDeleted);

    // Star button
    const star = document.createElement('button');
    star.className = 'fav-star';
    star.textContent = isFavorite ? '★' : '☆';
    star.setAttribute('aria-label', isFavorite ? 'Remove from favorites' : 'Add to favorites');
    star.addEventListener('click', (e) => {
      e.stopPropagation();
      SelectionManager.toggleFavorite(idx);
    });
    card.appendChild(star);

    // Selection badge
    const badge = document.createElement('div');
    badge.className = 'sel-badge';
    badge.textContent = '✓';
    if (isSelected) {
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
    card.appendChild(badge);

    // Thumbnail image
    const img = document.createElement('img');
    img.src = scene.thumbPath || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="112"%3E%3Crect fill="%23333" width="200" height="112"/%3E%3C/svg%3E';
    img.loading = 'lazy';
    img.alt = `Shot ${idx + 1}`;
    card.appendChild(img);

    // Timecode display
    const tc = document.createElement('div');
    tc.className = 'shot-tc';
    tc.textContent = `#${idx + 1} — ${formatTimecode(scene.startTime)}`;
    card.appendChild(tc);

    // Click handlers
    card.addEventListener('click', (e) => {
      if (e.shiftKey) {
        // Range select
        SelectionManager.selectRange(
          AppState.get('currentShotIdx'),
          idx
        );
      } else if (e.ctrlKey || e.metaKey) {
        // Toggle selection
        SelectionManager.selectShot(idx);
      } else {
        // Set current shot
        AppState.setState({ currentShotIdx: idx });
      }
    });

    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const items = [
        {
          label: isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
          action: () => SelectionManager.toggleFavorite(idx),
        },
        { separator: true },
        {
          label: isSelected ? 'Deselect' : 'Select',
          action: () => SelectionManager.selectShot(idx),
        },
        {
          label: 'Select Range',
          action: () => SelectionManager.selectRange(AppState.get('currentShotIdx'), idx),
        },
        { separator: true },
        {
          label: isDeleted ? 'Restore Shot' : 'Delete Shot',
          action: () => {
            if (isDeleted) {
              AppState.setState({
                deletedIndices: AppState.get('deletedIndices').filter((i) => i !== idx),
              });
            } else {
              SelectionManager.deleteSelected();
            }
          },
        },
      ];

      showContextMenu(items, e.clientX, e.clientY);
    });

    return card;
  };

  /**
   * Render grid with virtual scrolling
   */
  const renderGrid = () => {
    if (!_gridElement) return;

    const scenes = AppState.getVisibleScenes();
    _calculateVisibleRange();

    // Clear existing cards
    _gridElement.innerHTML = '';

    // Render only visible items + buffer
    for (let i = _visibleRange.start; i < _visibleRange.end && i < scenes.length; i++) {
      const scene = scenes[i];
      const card = _createShotCard(scene, scene.originalIdx);
      _gridElement.appendChild(card);
    }

    // Update selection bar
    SelectionManager.updateSelectionBar();
  };

  /**
   * Set grid item size (updates CSS grid-template-columns)
   * @param {number} px - Grid item size in pixels
   */
  const GRID_SIZES = [150, 200, 300, 400];

  const setGridSize = (px) => {
    if (_gridElement) {
      const gap = 20;
      _gridElement.style.gridTemplateColumns = `repeat(auto-fill, minmax(${px}px, 1fr))`;
      _itemSize = px + gap;
    }
    AppState.setState({ gridSize: px });
  };

  const zoomIn = () => {
    const current = AppState.get('gridSize');
    const next = GRID_SIZES.find((s) => s > current);
    if (next) setGridSize(next);
  };

  const zoomOut = () => {
    const current = AppState.get('gridSize');
    const prev = [...GRID_SIZES].reverse().find((s) => s < current);
    if (prev) setGridSize(prev);
  };

  const zoomReset = () => {
    setGridSize(200);
  };

  /**
   * Initialize module
   */
  const init = () => {
    _gridElement = document.querySelector('#shotGrid');
    _containerElement = document.querySelector('#shotGridContainer') || _gridElement?.parentElement;

    if (!_gridElement || !_containerElement) {
      console.error('ShotGrid: required DOM elements not found');
      return;
    }

    // Set default grid size
    setGridSize(AppState.get('gridSize'));

    // Scroll listener for virtual rendering
    let isScrolling = false;
    _containerElement.addEventListener('scroll', () => {
      if (isScrolling) return;

      isScrolling = true;
      clearTimeout(_scrollTimeout);
      _scrollTimeout = setTimeout(() => {
        renderGrid();
        isScrolling = false;
      }, 50);
    });

    // State listeners
    const cleanups = [];

    cleanups.push(
      AppState.onStateChange('scenes', () => {
        renderGrid();
      })
    );

    cleanups.push(
      AppState.onStateChange('selectedIndices', () => {
        renderGrid();
      })
    );

    cleanups.push(
      AppState.onStateChange('favoriteIndices', () => {
        renderGrid();
      })
    );

    cleanups.push(
      AppState.onStateChange('deletedIndices', () => {
        renderGrid();
      })
    );

    cleanups.push(
      AppState.onStateChange('filterMode', () => {
        renderGrid();
      })
    );

    cleanups.push(
      AppState.onStateChange('gridSize', (size) => {
        setGridSize(size);
        renderGrid();
      })
    );

    cleanups.push(
      AppState.onStateChange('currentShotIdx', () => {
        // Update visual highlight
        document.querySelectorAll('.shot-card').forEach((card) => {
          const idx = parseInt(card.dataset.idx, 10);
          card.classList.toggle('current', idx === AppState.get('currentShotIdx'));
        });
      })
    );

    _stateListeners = cleanups;

    // Initial render
    renderGrid();
  };

  /**
   * Cleanup module
   */
  const cleanup = () => {
    _stateListeners.forEach((fn) => fn());
    _stateListeners = [];
    clearTimeout(_scrollTimeout);
  };

  return {
    init,
    cleanup,
    renderGrid,
    setGridSize,
    zoomIn,
    zoomOut,
    zoomReset,
  };
})();
