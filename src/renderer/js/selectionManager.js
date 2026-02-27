/**
 * SelectionManager Module
 * Handles shot selection, favorites, and deletion operations
 * All state updates create new array references (no mutations)
 */
const SelectionManager = (() => {
  let _selectionBar = null;

  /**
   * Select/toggle a single shot
   * @param {number} idx - Shot index
   */
  const selectShot = (idx) => {
    const selected = AppState.get('selectedIndices');
    const newSelected = [...selected];

    const pos = newSelected.indexOf(idx);
    if (pos !== -1) {
      newSelected.splice(pos, 1);
    } else {
      newSelected.push(idx);
    }

    AppState.setState({ selectedIndices: newSelected });
  };

  /**
   * Select range of shots (inclusive)
   * @param {number} fromIdx - Start index
   * @param {number} toIdx - End index
   */
  const selectRange = (fromIdx, toIdx) => {
    if (fromIdx < 0 || toIdx < 0) {
      selectShot(toIdx >= 0 ? toIdx : fromIdx);
      return;
    }

    const start = Math.min(fromIdx, toIdx);
    const end = Math.max(fromIdx, toIdx);
    const newSelected = [];

    for (let i = start; i <= end; i++) {
      newSelected.push(i);
    }

    AppState.setState({ selectedIndices: newSelected });
  };

  /**
   * Select all visible shots
   */
  const selectAll = () => {
    const scenes = AppState.getVisibleScenes();
    const newSelected = scenes.map((scene) => scene.originalIdx);
    AppState.setState({ selectedIndices: newSelected });
  };

  /**
   * Deselect all shots
   */
  const deselectAll = () => {
    AppState.setState({ selectedIndices: [] });
  };

  /**
   * Invert selection for visible shots
   */
  const invertSelection = () => {
    const scenes = AppState.getVisibleScenes();
    const selected = AppState.get('selectedIndices');
    const selectedSet = new Set(selected);
    const newSelected = [];

    for (const scene of scenes) {
      if (!selectedSet.has(scene.originalIdx)) {
        newSelected.push(scene.originalIdx);
      }
    }

    AppState.setState({ selectedIndices: newSelected });
  };

  /**
   * Toggle favorite status of a shot
   * @param {idx} idx - Shot index
   */
  const toggleFavorite = (idx) => {
    const favorites = AppState.get('favoriteIndices');
    const newFavorites = [...favorites];

    const pos = newFavorites.indexOf(idx);
    if (pos !== -1) {
      newFavorites.splice(pos, 1);
    } else {
      newFavorites.push(idx);
    }

    AppState.setState({ favoriteIndices: newFavorites });
    UndoRedo.commit();
  };

  /**
   * Add all selected shots to favorites
   */
  const favSelected = () => {
    const selected = AppState.get('selectedIndices');
    const favorites = AppState.get('favoriteIndices');
    const favoriteSet = new Set(favorites);

    for (const idx of selected) {
      favoriteSet.add(idx);
    }

    const newFavorites = Array.from(favoriteSet).sort((a, b) => a - b);
    AppState.setState({ favoriteIndices: newFavorites });
    UndoRedo.commit();
  };

  /**
   * Remove all selected shots from favorites
   */
  const unfavSelected = () => {
    const selected = AppState.get('selectedIndices');
    const favorites = AppState.get('favoriteIndices');
    const selectedSet = new Set(selected);
    const newFavorites = favorites.filter((idx) => !selectedSet.has(idx));

    AppState.setState({ favoriteIndices: newFavorites });
    UndoRedo.commit();
  };

  /**
   * Delete selected shots
   * Adds indices to deletedIndices and clears selection
   */
  const deleteSelected = () => {
    const selected = AppState.get('selectedIndices');
    if (selected.length === 0) return;

    const deleted = AppState.get('deletedIndices');
    const deletedSet = new Set(deleted);

    for (const idx of selected) {
      deletedSet.add(idx);
    }

    const newDeleted = Array.from(deletedSet).sort((a, b) => a - b);

    AppState.setState({
      deletedIndices: newDeleted,
      selectedIndices: [],
    });

    UndoRedo.commit();
  };

  /**
   * Update visibility and content of selection bar
   */
  const updateSelectionBar = () => {
    if (!_selectionBar) {
      _selectionBar = document.querySelector('#selectionBar');
    }

    if (!_selectionBar) return;

    const selectedCount = AppState.get('selectedIndices').length;

    if (selectedCount === 0) {
      _selectionBar.style.display = 'none';
      return;
    }

    _selectionBar.style.display = 'flex';

    // Update count
    const countEl = _selectionBar.querySelector('.sel-count');
    if (countEl) {
      countEl.textContent = `${selectedCount} selected`;
    }

    // Update favorite button text
    const selected = AppState.get('selectedIndices');
    const favorites = AppState.get('favoriteIndices');
    const selectedSet = new Set(selected);
    const allAreFav = selected.every((idx) => favorites.includes(idx));

    const favBtn = _selectionBar.querySelector('[data-action="favorite"]');
    if (favBtn) {
      favBtn.textContent = allAreFav ? 'Unfavorite' : 'Favorite';
    }
  };

  /**
   * Initialize module
   */
  const init = () => {
    _selectionBar = document.querySelector('#selectionBar');

    if (!_selectionBar) {
      console.warn('SelectionManager: selection bar not found');
      return;
    }

    // Bind selection bar buttons
    const favBtn = _selectionBar.querySelector('[data-action="favorite"]');
    if (favBtn) {
      favBtn.addEventListener('click', () => {
        const selected = AppState.get('selectedIndices');
        const favorites = AppState.get('favoriteIndices');
        const allAreFav = selected.every((idx) => favorites.includes(idx));

        if (allAreFav) {
          unfavSelected();
        } else {
          favSelected();
        }
      });
    }

    const deleteBtn = _selectionBar.querySelector('[data-action="delete"]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        deleteSelected();
      });
    }

    const invertBtn = _selectionBar.querySelector('[data-action="invert"]');
    if (invertBtn) {
      invertBtn.addEventListener('click', () => {
        invertSelection();
      });
    }

    const deselectBtn = _selectionBar.querySelector('[data-action="deselect"]');
    if (deselectBtn) {
      deselectBtn.addEventListener('click', () => {
        deselectAll();
      });
    }

    // Listen to selection changes
    AppState.onStateChange('selectedIndices', () => {
      updateSelectionBar();
    });
  };

  return {
    init,
    selectShot,
    selectRange,
    selectAll,
    deselectAll,
    invertSelection,
    toggleFavorite,
    favSelected,
    unfavSelected,
    deleteSelected,
    updateSelectionBar,
  };
})();
