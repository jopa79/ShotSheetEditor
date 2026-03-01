/**
 * SelectionManager Module
 * Handles shot selection, favorites, and deletion operations
 * All state updates create new array references (no mutations)
 */
const SelectionManager = (() => {
  let _selectionBar = null;
  let _stateCleanup = null;
  // Tracked DOM-Listener für sauberes Cleanup (Fix #100)
  let _boundListeners = [];

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
   * Bounds-Check gegen scenes.length und deletedIndices (Fix #148)
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

    // Nur gültige, nicht-gelöschte Indizes aufnehmen
    const scenesLength = AppState.get('scenes').length;
    const deletedSet = new Set(AppState.get('deletedIndices'));
    const newSelected = [];

    for (let i = start; i <= end; i++) {
      if (i < scenesLength && !deletedSet.has(i)) {
        newSelected.push(i);
      }
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
   * Fix #87: UndoRedo.commit() VOR setState() aufrufen
   * @param {number} idx - Shot index
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

    UndoRedo.commit(); // ZUERST: Snapshot des alten States
    AppState.setState({ favoriteIndices: newFavorites }); // DANACH: State ändern
  };

  /**
   * Add all selected shots to favorites
   * Fix #87: UndoRedo.commit() VOR setState() aufrufen
   */
  const favSelected = () => {
    const selected = AppState.get('selectedIndices');
    const favorites = AppState.get('favoriteIndices');
    const favoriteSet = new Set(favorites);

    for (const idx of selected) {
      favoriteSet.add(idx);
    }

    const newFavorites = Array.from(favoriteSet).sort((a, b) => a - b);
    UndoRedo.commit(); // ZUERST: Snapshot des alten States
    AppState.setState({ favoriteIndices: newFavorites }); // DANACH: State ändern
  };

  /**
   * Remove all selected shots from favorites
   * Fix #87: UndoRedo.commit() VOR setState() aufrufen
   */
  const unfavSelected = () => {
    const selected = AppState.get('selectedIndices');
    const favorites = AppState.get('favoriteIndices');
    const selectedSet = new Set(selected);
    const newFavorites = favorites.filter((idx) => !selectedSet.has(idx));

    UndoRedo.commit(); // ZUERST: Snapshot des alten States
    AppState.setState({ favoriteIndices: newFavorites }); // DANACH: State ändern
  };

  /**
   * Delete selected shots
   * Adds indices to deletedIndices and clears selection
   * Fix #87: UndoRedo.commit() VOR setState() aufrufen
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

    UndoRedo.commit(); // ZUERST: Snapshot des alten States
    AppState.setState({ // DANACH: State ändern
      deletedIndices: newDeleted,
      selectedIndices: [],
    });
  };

  /**
   * Einzelnen Shot löschen (unabhängig von Selektion)
   * Fix #87: UndoRedo.commit() VOR setState() aufrufen
   * @param {number} idx - Shot index
   */
  const deleteSingle = (idx) => {
    const deleted = AppState.get('deletedIndices');
    if (deleted.includes(idx)) return;

    const newDeleted = [...deleted, idx].sort((a, b) => a - b);
    UndoRedo.commit(); // ZUERST: Snapshot des alten States
    AppState.setState({ deletedIndices: newDeleted }); // DANACH: State ändern
  };

  /**
   * Einzelnen Shot wiederherstellen
   * Fix #87: UndoRedo.commit() VOR setState() aufrufen
   * @param {number} idx - Shot index
   */
  const restoreSingle = (idx) => {
    const deleted = AppState.get('deletedIndices');
    const newDeleted = deleted.filter((i) => i !== idx);
    UndoRedo.commit(); // ZUERST: Snapshot des alten States
    AppState.setState({ deletedIndices: newDeleted }); // DANACH: State ändern
  };

  /**
   * Context Menu für Collection-Zuweisung anzeigen
   * @param {MouseEvent} e - Click-Event
   */
  const _showCollectionMenu = (e) => {
    const selected = AppState.get('selectedIndices');
    if (selected.length === 0) return;

    const collections = AppState.get('collections');
    const items = [];

    // Bestehende Collections als Menüpunkte
    for (const col of collections) {
      items.push({
        label: `${col.name} (${col.indices.length})`,
        action: () => {
          CollectionManager.addToCollection(col.id, selected);
          showToast(`${selected.length} shots added to "${col.name}"`, 'success');
        },
      });
    }

    if (collections.length > 0) {
      items.push({ separator: true });
    }

    // "New Collection from Selection"
    items.push({
      label: 'New Collection from Selection...',
      action: () => {
        const name = prompt('Collection name:');
        if (name && name.trim()) {
          CollectionManager.createCollection(name, selected);
          showToast(`Collection "${name.trim()}" created with ${selected.length} shots`, 'success');
        }
      },
    });

    const rect = e.target.getBoundingClientRect();
    showContextMenu(items, rect.left, rect.top - 4);
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

    // Anzahl aktualisieren
    const countEl = _selectionBar.querySelector('#selectionCount');
    if (countEl) {
      countEl.textContent = `${selectedCount} selected`;
    }

    // Favorite/Unfavorite Button-Sichtbarkeit umschalten
    const selected = AppState.get('selectedIndices');
    const favorites = AppState.get('favoriteIndices');
    const allAreFav = selected.every((idx) => favorites.includes(idx));

    const markFavBtn = _selectionBar.querySelector('#btnMarkFav');
    const unmarkFavBtn = _selectionBar.querySelector('#btnUnmarkFav');
    if (markFavBtn) markFavBtn.style.display = allAreFav ? 'none' : '';
    if (unmarkFavBtn) unmarkFavBtn.style.display = allAreFav ? '' : 'none';
  };

  /**
   * Hilfsfunktion: Listener tracken für späteres Cleanup (Fix #100)
   * @param {Element} el - DOM-Element
   * @param {string} type - Event-Typ
   * @param {Function} handler - Event-Handler
   */
  const _addTrackedListener = (el, type, handler) => {
    if (!el) return;
    el.addEventListener(type, handler);
    _boundListeners.push({ el, type, handler });
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

    // Benannte Handler für "Add to Collection" Button (Fix #100)
    const _onAddToCollection = (e) => _showCollectionMenu(e);

    // Selection-Bar-Buttons mit Tracking registrieren (Fix #100)
    const favBtn = _selectionBar.querySelector('#btnMarkFav');
    _addTrackedListener(favBtn, 'click', favSelected);

    const unfavBtn = _selectionBar.querySelector('#btnUnmarkFav');
    _addTrackedListener(unfavBtn, 'click', unfavSelected);

    const deleteBtn = _selectionBar.querySelector('#btnDelete');
    _addTrackedListener(deleteBtn, 'click', deleteSelected);

    // "→ Collection" Button — zeigt Context Menu mit bestehenden Collections
    const addToColBtn = _selectionBar.querySelector('#btnAddToCollection');
    _addTrackedListener(addToColBtn, 'click', _onAddToCollection);

    const deselectBtn = _selectionBar.querySelector('#btnClearSelection');
    _addTrackedListener(deselectBtn, 'click', deselectAll);

    // State-Listener für Selektionsänderungen
    _stateCleanup = AppState.onStateChange('selectedIndices', () => {
      updateSelectionBar();
    });
  };

  /**
   * Cleanup module — State-Listener und DOM-Listener entfernen (Fix #100)
   */
  const cleanup = () => {
    if (_stateCleanup) {
      _stateCleanup();
      _stateCleanup = null;
    }
    // Alle tracked DOM-Listener entfernen
    for (const { el, type, handler } of _boundListeners) {
      el.removeEventListener(type, handler);
    }
    _boundListeners = [];
  };

  return {
    init,
    cleanup,
    selectShot,
    selectRange,
    selectAll,
    deselectAll,
    invertSelection,
    toggleFavorite,
    favSelected,
    unfavSelected,
    deleteSelected,
    deleteSingle,
    restoreSingle,
    updateSelectionBar,
  };
})();
