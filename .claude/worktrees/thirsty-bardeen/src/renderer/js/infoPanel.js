/**
 * InfoPanel Module
 * Zeigt Scene-Details und Collections im rechten Sidebar-Panel
 * Oberer Bereich: Aktuelle Shot-Info (Timecode, Index, Status)
 * Unterer Bereich: Collections-Liste mit Erstell-/Filter-Funktionen
 */
const InfoPanel = (() => {
  let _panelBody = null;
  let _stateListeners = [];
  // AbortController zum Bereinigen von DOM-Event-Listenern bei jedem re-render (#152/#153)
  let _renderAbortController = null;

  /**
   * Scene-Info Bereich rendern
   * @returns {HTMLElement}
   */
  const _renderSceneInfo = () => {
    const container = document.createElement('div');
    container.className = 'info-content';

    const currentIdx = AppState.get('currentShotIdx');
    const scene = AppState.getCurrentScene();

    if (!scene || currentIdx < 0) {
      const placeholder = document.createElement('div');
      placeholder.className = 'info-placeholder';
      placeholder.textContent = 'Select a shot to view details';
      container.appendChild(placeholder);
      return container;
    }

    // Shot-Nummer
    const indexField = _createInfoField('Shot', `#${currentIdx + 1}`);
    container.appendChild(indexField);

    // Timecode
    const tcField = _createInfoField('Timecode', formatTimecode(scene.startTime));
    container.appendChild(tcField);

    // Status-Badges
    const isFav = AppState.get('favoriteIndices').includes(currentIdx);
    const isDeleted = AppState.get('deletedIndices').includes(currentIdx);
    const statusParts = [];
    if (isFav) statusParts.push('Favorite');
    if (isDeleted) statusParts.push('Deleted');
    if (statusParts.length === 0) statusParts.push('Active');
    const statusField = _createInfoField('Status', statusParts.join(', '));
    container.appendChild(statusField);

    // Zugehörige Collections auflisten
    const collections = AppState.get('collections');
    const memberOf = collections.filter((c) => c.indices.includes(currentIdx));
    if (memberOf.length > 0) {
      const colNames = memberOf.map((c) => c.name).join(', ');
      const colField = _createInfoField('Collections', colNames);
      container.appendChild(colField);
    }

    return container;
  };

  /**
   * Info-Feld erstellen (Label + Value)
   * @param {string} label
   * @param {string} value
   * @returns {HTMLElement}
   */
  const _createInfoField = (label, value) => {
    const field = document.createElement('div');
    field.className = 'info-field';

    const labelEl = document.createElement('div');
    labelEl.className = 'info-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('div');
    valueEl.className = 'info-value secondary';
    valueEl.textContent = value;

    field.appendChild(labelEl);
    field.appendChild(valueEl);
    return field;
  };

  /**
   * Collections-Bereich rendern
   * @param {AbortSignal} signal - Signal zum Abbrechen von Event-Listenern
   * @returns {HTMLElement}
   */
  const _renderCollections = (signal) => {
    const container = document.createElement('div');
    container.className = 'info-content';

    // Trennlinie
    const divider = document.createElement('div');
    divider.className = 'divider';
    container.appendChild(divider);

    // Header mit "+ New" Button
    const header = document.createElement('div');
    header.className = 'collection-header';

    const title = document.createElement('div');
    title.className = 'info-label';
    title.textContent = 'Collections';

    const addBtn = document.createElement('button');
    addBtn.className = 'collection-add-btn';
    addBtn.textContent = '+ New';
    addBtn.addEventListener('click', () => {
      const name = prompt('Collection name:');
      if (name && name.trim()) {
        CollectionManager.createCollection(name);
      }
    }, { signal });

    header.appendChild(title);
    header.appendChild(addBtn);
    container.appendChild(header);

    // Collection-Liste
    const collections = AppState.get('collections');
    const activeId = AppState.get('activeCollectionId');

    if (collections.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'collection-empty';
      empty.textContent = 'No collections yet';
      container.appendChild(empty);
      return container;
    }

    const list = document.createElement('div');
    list.className = 'collection-list';

    for (const col of collections) {
      const item = document.createElement('div');
      item.className = 'collection-item';
      if (col.id === activeId) {
        item.classList.add('active');
      }

      // Name + Count
      const info = document.createElement('div');
      info.className = 'collection-item-info';

      const nameEl = document.createElement('span');
      nameEl.className = 'collection-item-name';
      nameEl.textContent = col.name;

      const countEl = document.createElement('span');
      countEl.className = 'collection-item-count';
      countEl.textContent = `${col.indices.length}`;

      info.appendChild(nameEl);
      info.appendChild(countEl);

      // Click → Filter aktivieren/deaktivieren (Toggle)
      info.addEventListener('click', () => {
        if (AppState.get('activeCollectionId') === col.id) {
          CollectionManager.clearActiveCollection();
        } else {
          CollectionManager.setActiveCollection(col.id);
        }
      }, { signal });

      // Action-Buttons (Edit/Delete)
      const actions = document.createElement('div');
      actions.className = 'collection-item-actions';

      const renameBtn = document.createElement('button');
      renameBtn.className = 'collection-action-btn';
      renameBtn.textContent = 'Rename';
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newName = prompt('Rename collection:', col.name);
        if (newName && newName.trim()) {
          CollectionManager.renameCollection(col.id, newName);
        }
      }, { signal });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'collection-action-btn danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete collection "${col.name}"?`)) {
          CollectionManager.deleteCollection(col.id);
        }
      }, { signal });

      actions.appendChild(renameBtn);
      actions.appendChild(deleteBtn);

      item.appendChild(info);
      item.appendChild(actions);
      list.appendChild(item);
    }

    container.appendChild(list);
    return container;
  };

  /**
   * Komplettes Panel neu rendern
   * AbortController stellt sicher dass alle DOM-Listener des vorherigen Renders
   * abgebrochen werden bevor neue Elemente erstellt werden (#152/#153)
   */
  const render = () => {
    if (!_panelBody) return;

    // Vorherige DOM-Listener abbrechen
    if (_renderAbortController) {
      _renderAbortController.abort();
    }
    _renderAbortController = new AbortController();
    const signal = _renderAbortController.signal;

    // Bestehenden Inhalt entfernen
    while (_panelBody.firstChild) {
      _panelBody.removeChild(_panelBody.firstChild);
    }

    _panelBody.appendChild(_renderSceneInfo());
    _panelBody.appendChild(_renderCollections(signal));
  };

  /**
   * Initialize module
   */
  const init = () => {
    _panelBody = document.querySelector('#infoPanelBody');

    if (!_panelBody) {
      console.warn('InfoPanel: #infoPanelBody not found');
      return;
    }

    const cleanups = [];

    // Panel bei relevanten State-Änderungen neu rendern
    const keys = [
      'currentShotIdx',
      'collections',
      'activeCollectionId',
      'favoriteIndices',
      'deletedIndices',
      'scenes',
    ];
    for (const key of keys) {
      cleanups.push(AppState.onStateChange(key, () => render()));
    }

    _stateListeners = cleanups;

    // Initial rendern
    render();
  };

  /**
   * Cleanup module
   */
  const cleanup = () => {
    _stateListeners.forEach((fn) => fn());
    _stateListeners = [];
    if (_renderAbortController) {
      _renderAbortController.abort();
      _renderAbortController = null;
    }
  };

  return {
    init,
    cleanup,
    render,
  };
})();
