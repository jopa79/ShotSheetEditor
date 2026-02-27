/**
 * UndoRedo Module
 * Tracks undo/redo snapshots of modifiable state
 * Max stack size: 50 snapshots
 */
const UndoRedo = (() => {
  const MAX_STACK_SIZE = 50;

  let _undoStack = [];
  let _redoStack = [];

  /**
   * Create deep clone of snapshot data
   * @param {object} snapshot - State snapshot
   * @returns {object} Deep cloned snapshot
   */
  const _deepClone = (snapshot) => {
    return JSON.parse(JSON.stringify(snapshot));
  };

  /**
   * Create snapshot of current modifiable state
   * @returns {object} Snapshot object
   */
  const _createSnapshot = () => {
    return {
      favoriteIndices: _deepClone(AppState.get('favoriteIndices')),
      deletedIndices: _deepClone(AppState.get('deletedIndices')),
      scenes: _deepClone(AppState.get('scenes')),
    };
  };

  /**
   * Apply snapshot back to AppState
   * @param {object} snapshot - Snapshot to apply
   */
  const _applySnapshot = (snapshot) => {
    AppState.setState({
      favoriteIndices: _deepClone(snapshot.favoriteIndices),
      deletedIndices: _deepClone(snapshot.deletedIndices),
      scenes: _deepClone(snapshot.scenes),
    });
  };

  /**
   * Commit current state to undo stack
   * Clears redo stack when new action is performed
   */
  const commit = () => {
    const snapshot = _createSnapshot();
    _undoStack.push(snapshot);

    // Clear redo stack on new action
    _redoStack = [];

    // Maintain max stack size
    if (_undoStack.length > MAX_STACK_SIZE) {
      _undoStack.shift();
    }

    // Mark project as dirty
    AppState.setState({ isDirty: true });
  };

  /**
   * Undo last action
   */
  const undo = () => {
    if (_undoStack.length === 0) {
      return;
    }

    // Current state goes to redo stack
    const currentSnapshot = _createSnapshot();
    _redoStack.push(currentSnapshot);

    // Pop from undo and apply
    const previousSnapshot = _undoStack.pop();
    _applySnapshot(previousSnapshot);
  };

  /**
   * Redo last undone action
   */
  const redo = () => {
    if (_redoStack.length === 0) {
      return;
    }

    // Current state goes to undo stack
    const currentSnapshot = _createSnapshot();
    _undoStack.push(currentSnapshot);

    // Pop from redo and apply
    const nextSnapshot = _redoStack.pop();
    _applySnapshot(nextSnapshot);
  };

  /**
   * Check if undo is available
   * @returns {boolean}
   */
  const canUndo = () => {
    return _undoStack.length > 0;
  };

  /**
   * Check if redo is available
   * @returns {boolean}
   */
  const canRedo = () => {
    return _redoStack.length > 0;
  };

  /**
   * Clear all undo/redo history
   */
  const clear = () => {
    _undoStack = [];
    _redoStack = [];
  };

  return {
    commit,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
  };
})();
