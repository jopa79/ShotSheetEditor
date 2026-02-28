/**
 * ShotGrid Module
 * Renders shot cards in a CSS grid layout
 * Handles selection, favorites, and filtering
 */
const ShotGrid = (() => {
  let _gridElement = null;
  let _emptyStateElement = null;
  let _stateListeners = [];

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

    // Thumbnail-Wrapper (CSS erwartet .shot-card-thumb > img)
    const thumb = document.createElement('div');
    thumb.className = 'shot-card-thumb';
    const img = document.createElement('img');
    img.src = scene.thumbPath || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="112"%3E%3Crect fill="%23333" width="200" height="112"/%3E%3C/svg%3E';
    img.loading = 'lazy';
    img.alt = `Shot ${idx + 1}`;
    thumb.appendChild(img);
    card.appendChild(thumb);

    // Footer mit Timecode (CSS erwartet .shot-card-footer > .shot-card-tc)
    const footer = document.createElement('div');
    footer.className = 'shot-card-footer';
    const tc = document.createElement('div');
    tc.className = 'shot-card-tc';
    tc.textContent = `#${idx + 1} — ${formatTimecode(scene.startTime)}`;
    footer.appendChild(tc);
    card.appendChild(footer);

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
              SelectionManager.restoreSingle(idx);
            } else {
              SelectionManager.deleteSingle(idx);
            }
          },
        },
        { separator: true },
        {
          label: 'Add to Collection...',
          action: () => {
            const collections = AppState.get('collections');
            if (collections.length === 0) {
              // Keine Collections → direkt neue erstellen
              const name = prompt('Collection name:');
              if (name && name.trim()) {
                CollectionManager.createCollection(name, [idx]);
                showToast(`Collection "${name.trim()}" created`, 'success');
              }
              return;
            }
            // Submenu mit bestehenden Collections zeigen
            const subItems = collections.map((col) => ({
              label: `${col.name} (${col.indices.length})`,
              action: () => {
                CollectionManager.addToCollection(col.id, [idx]);
                showToast(`Shot added to "${col.name}"`, 'success');
              },
            }));
            subItems.push({ separator: true });
            subItems.push({
              label: 'New Collection...',
              action: () => {
                const name = prompt('Collection name:');
                if (name && name.trim()) {
                  CollectionManager.createCollection(name, [idx]);
                  showToast(`Collection "${name.trim()}" created`, 'success');
                }
              },
            });
            showContextMenu(subItems, e.clientX, e.clientY);
          },
        },
      ];

      showContextMenu(items, e.clientX, e.clientY);
    });

    return card;
  };

  /**
   * Empty-State je nach App-Zustand aktualisieren
   */
  const _updateEmptyState = (sceneCount) => {
    if (!_emptyStateElement) return;

    if (sceneCount > 0) {
      // Szenen vorhanden → Empty State ausblenden
      _emptyStateElement.style.display = 'none';
      return;
    }

    // Keine Szenen → Empty State zeigen mit kontextabhängigem Text
    _emptyStateElement.style.display = '';
    const titleEl = _emptyStateElement.querySelector('.empty-state-title');
    const hintEl = _emptyStateElement.querySelector('.empty-state-hint');

    if (AppState.get('videoPath')) {
      if (titleEl) titleEl.textContent = 'No Scenes Detected';
      if (hintEl) hintEl.textContent = 'Click "Detect Scenes" to analyze the video';
    } else {
      if (titleEl) titleEl.textContent = 'No Video Loaded';
      if (hintEl) hintEl.textContent = 'Drop a video or click Open Video to begin';
    }
  };

  const renderGrid = () => {
    if (!_gridElement) return;

    const scenes = AppState.getVisibleScenes();

    // Empty-State aktualisieren
    _updateEmptyState(scenes.length);

    // Bestehende Karten entfernen
    while (_gridElement.firstChild) {
      _gridElement.removeChild(_gridElement.firstChild);
    }

    // Alle Szenen rendern — bei typischen Szenenanzahlen (<1000) performant genug
    for (const scene of scenes) {
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
  const FOOTER_HEIGHT = 32; // px — .shot-card-footer Höhe

  /**
   * Zeilenhöhe basierend auf Spaltenbreite und Video-Seitenverhältnis berechnen
   * Wird bei Größenänderung und beim Laden von Video-Metadaten aufgerufen
   */
  const _updateGridAutoRows = () => {
    if (!_gridElement) return;
    const px = AppState.get('gridSize');
    const meta = AppState.get('videoMeta');
    const w = meta?.data?.width || 16;
    const h = meta?.data?.height || 9;
    const thumbHeight = Math.round(px * (h / w));
    _gridElement.style.gridAutoRows = `${thumbHeight + FOOTER_HEIGHT}px`;
  };

  const setGridSize = (px) => {
    if (_gridElement) {
      _gridElement.style.gridTemplateColumns = `repeat(auto-fill, minmax(${px}px, 1fr))`;
    }
    AppState.setState({ gridSize: px });
    _updateGridAutoRows();
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
    _emptyStateElement = document.querySelector('#emptyState');

    if (!_gridElement) {
      console.error('ShotGrid: #shotGrid element not found');
      return;
    }

    // Set default grid size
    setGridSize(AppState.get('gridSize'));

    // State listeners
    const cleanups = [];

    cleanups.push(
      AppState.onStateChange('scenes', () => {
        renderGrid();
      })
    );

    // Empty State aktualisieren wenn Video geladen/entladen wird
    cleanups.push(
      AppState.onStateChange('videoPath', () => {
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
      AppState.onStateChange('activeCollectionId', () => {
        renderGrid();
      })
    );

    cleanups.push(
      AppState.onStateChange('gridSize', (size) => {
        setGridSize(size);
        renderGrid();
      })
    );

    // Seitenverhältnis bei neuen Video-Metadaten neu berechnen
    cleanups.push(
      AppState.onStateChange('videoMeta', () => {
        _updateGridAutoRows();
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
  };

  /**
   * Einzelnes Thumbnail aktualisieren ohne Full-Re-Render
   * @param {number} index - Szenen-Index
   * @param {string} thumbPath - Pfad zum extrahierten Thumbnail
   */
  const updateThumbnail = (index, thumbPath) => {
    if (!_gridElement) return;
    const card = _gridElement.querySelector(`[data-idx="${index}"]`);
    if (!card) return;
    const img = card.querySelector('.shot-card-thumb img');
    if (img) {
      img.src = 'file://' + thumbPath;
    }
  };

  return {
    init,
    cleanup,
    renderGrid,
    updateThumbnail,
    setGridSize,
    zoomIn,
    zoomOut,
    zoomReset,
  };
})();
