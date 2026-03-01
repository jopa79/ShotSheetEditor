/**
 * CollectionManager Module
 * CRUD-Operationen für Shot-Collections
 * Collections gruppieren Szenen-Indizes, ähnlich wie favoriteIndices
 */
const CollectionManager = (() => {
  /**
   * Eindeutige Collection-ID generieren
   * @returns {string} z.B. "col_a1b2c3"
   */
  const _generateId = () => {
    return 'col_' + Math.random().toString(36).substring(2, 8);
  };

  /**
   * Neue Collection erstellen
   * Fix #141: name wird validiert — TypeError bei leerem/falschem Wert verhindern
   * Fix #142: indices wird auf Array geprüft
   * Fix #123: UndoRedo.commit() VOR setState() aufrufen
   * @param {string} name - Name der Collection
   * @param {number[]} indices - Initiale Szenen-Indizes
   * @returns {object} Die erstellte Collection
   */
  const createCollection = (name, indices = []) => {
    // Name-Validierung (Fix #141)
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error('Collection name must be a non-empty string');
    }

    // Array-Check für indices (Fix #142)
    const safeIndices = Array.isArray(indices) ? indices : [];

    const collections = AppState.get('collections');
    const uniqueIndices = [...new Set(safeIndices)].sort((a, b) => a - b);

    const collection = {
      id: _generateId(),
      name: name.trim(),
      indices: uniqueIndices,
    };

    UndoRedo.commit(); // ZUERST: Snapshot des alten States (Fix #123)
    AppState.setState({ collections: [...collections, collection] }); // DANACH: State ändern
    return collection;
  };

  /**
   * Collection löschen
   * Fix #123: UndoRedo.commit() VOR setState() aufrufen
   * @param {string} id - Collection-ID
   */
  const deleteCollection = (id) => {
    const collections = AppState.get('collections');
    const newCollections = collections.filter((c) => c.id !== id);
    const updates = { collections: newCollections };

    // Aktive Collection zurücksetzen wenn die gelöschte aktiv war
    if (AppState.get('activeCollectionId') === id) {
      updates.activeCollectionId = null;
      updates.filterMode = 'all';
    }

    UndoRedo.commit(); // ZUERST: Snapshot des alten States (Fix #123)
    AppState.setState(updates); // DANACH: State ändern
  };

  /**
   * Collection umbenennen
   * Fix #141: name wird validiert — TypeError bei leerem/falschem Wert verhindern
   * Fix #123: UndoRedo.commit() VOR setState() aufrufen
   * @param {string} id - Collection-ID
   * @param {string} name - Neuer Name
   */
  const renameCollection = (id, name) => {
    // Name-Validierung (Fix #141)
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error('Collection name must be a non-empty string');
    }

    const collections = AppState.get('collections');
    const newCollections = collections.map((c) =>
      c.id === id ? { ...c, name: name.trim() } : c
    );

    UndoRedo.commit(); // ZUERST: Snapshot des alten States (Fix #123)
    AppState.setState({ collections: newCollections }); // DANACH: State ändern
  };

  /**
   * Szenen zu einer Collection hinzufügen (Set-basiert, keine Duplikate)
   * Fix #142: indices wird auf Array geprüft
   * Fix #123: UndoRedo.commit() VOR setState() aufrufen
   * @param {string} id - Collection-ID
   * @param {number[]} indices - Hinzuzufügende Indizes
   */
  const addToCollection = (id, indices) => {
    // Array-Check für indices (Fix #142)
    const safeIndices = Array.isArray(indices) ? indices : [];

    const collections = AppState.get('collections');
    const newCollections = collections.map((c) => {
      if (c.id !== id) return c;
      const indexSet = new Set(c.indices);
      for (const idx of safeIndices) {
        indexSet.add(idx);
      }
      return { ...c, indices: [...indexSet].sort((a, b) => a - b) };
    });

    UndoRedo.commit(); // ZUERST: Snapshot des alten States (Fix #123)
    AppState.setState({ collections: newCollections }); // DANACH: State ändern
  };

  /**
   * Szenen aus einer Collection entfernen
   * Fix #123: UndoRedo.commit() VOR setState() aufrufen
   * @param {string} id - Collection-ID
   * @param {number[]} indices - Zu entfernende Indizes
   */
  const removeFromCollection = (id, indices) => {
    const removeSet = new Set(Array.isArray(indices) ? indices : []);
    const collections = AppState.get('collections');
    const newCollections = collections.map((c) => {
      if (c.id !== id) return c;
      return { ...c, indices: c.indices.filter((i) => !removeSet.has(i)) };
    });

    UndoRedo.commit(); // ZUERST: Snapshot des alten States (Fix #123)
    AppState.setState({ collections: newCollections }); // DANACH: State ändern
  };

  /**
   * Collection als aktiven Filter setzen
   * @param {string} id - Collection-ID
   */
  const setActiveCollection = (id) => {
    AppState.setState({
      filterMode: 'collection',
      activeCollectionId: id,
    });
  };

  /**
   * Collection-Filter aufheben → zurück zu "all"
   */
  const clearActiveCollection = () => {
    AppState.setState({
      filterMode: 'all',
      activeCollectionId: null,
    });
  };

  /**
   * Collection per ID holen
   * @param {string} id - Collection-ID
   * @returns {object|null}
   */
  const getCollection = (id) => {
    return AppState.get('collections').find((c) => c.id === id) || null;
  };

  return {
    createCollection,
    deleteCollection,
    renameCollection,
    addToCollection,
    removeFromCollection,
    setActiveCollection,
    clearActiveCollection,
    getCollection,
  };
})();
