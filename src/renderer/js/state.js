/**
 * AppState Module
 * Centralized state management with listener support
 * Pattern: IIFE returning public API, internal state, and listener registry
 */
const AppState = (() => {
  // Internal state object
  const _state = {
    videoPath: null,
    videoMeta: null,
    scenes: [],
    threshold: 0.3,
    selectedIndices: [],
    favoriteIndices: [],
    deletedIndices: [],
    filterMode: 'all', // 'all' or 'favorites'
    currentShotIdx: -1,
    isDetecting: false,
    detectProgress: 0,
    isDirty: false,
    gridSize: 200,
    projectPath: null,
    projectData: null,
    isTranscoding: false,
    transcodeProgress: 0,
  };

  // Listeners registry: key -> [callback, ...]
  const _listeners = {};

  /**
   * Get a specific state value
   * @param {string} key - State key
   * @returns {*} State value
   */
  const get = (key) => {
    return _state[key];
  };

  /**
   * Get shallow copy of entire state
   * @returns {object} Shallow copy of _state
   */
  const getState = () => {
    return { ..._state };
  };

  /**
   * Update state with partial object
   * Triggers listeners for changed keys
   * @param {object} partial - Partial state update
   */
  const setState = (partial) => {
    if (!partial || typeof partial !== 'object') {
      return;
    }

    let hasChanges = false;

    for (const [key, value] of Object.entries(partial)) {
      if (key in _state) {
        // Only trigger if value actually changed
        if (_state[key] !== value) {
          _state[key] = value;
          hasChanges = true;

          // Call registered listeners for this key
          if (_listeners[key]) {
            _listeners[key].forEach((callback) => {
              try {
                callback(value);
              } catch (err) {
                console.error(`Error in state listener for "${key}":`, err);
              }
            });
          }
        }
      }
    }

    // Always trigger 'any' listeners if there were changes
    if (hasChanges && _listeners['*']) {
      _listeners['*'].forEach((callback) => {
        try {
          callback(_state);
        } catch (err) {
          console.error('Error in state listener (*):', err);
        }
      });
    }
  };

  /**
   * Reset state to defaults
   */
  const resetState = () => {
    setState({
      videoPath: null,
      videoMeta: null,
      scenes: [],
      threshold: 0.3,
      selectedIndices: [],
      favoriteIndices: [],
      deletedIndices: [],
      filterMode: 'all',
      currentShotIdx: -1,
      isDetecting: false,
      detectProgress: 0,
      isDirty: false,
      gridSize: 200,
      projectPath: null,
      projectData: null,
      isTranscoding: false,
      transcodeProgress: 0,
    });
  };

  /**
   * Register listener for state changes
   * @param {string} key - State key or '*' for any change
   * @param {function} callback - Called with new value (or full state if key='*')
   * @returns {function} Cleanup function to unregister listener
   */
  const onStateChange = (key, callback) => {
    if (!_listeners[key]) {
      _listeners[key] = [];
    }

    _listeners[key].push(callback);

    // Return cleanup function
    return () => {
      const idx = _listeners[key].indexOf(callback);
      if (idx !== -1) {
        _listeners[key].splice(idx, 1);
      }
    };
  };

  /**
   * Helper: Check if video is loaded
   * @returns {boolean}
   */
  const hasVideo = () => {
    return _state.videoPath !== null && _state.videoMeta !== null;
  };

  /**
   * Helper: Get current scene object
   * @returns {object|null} Current scene or null
   */
  const getCurrentScene = () => {
    if (_state.currentShotIdx < 0 || _state.currentShotIdx >= _state.scenes.length) {
      return null;
    }
    return _state.scenes[_state.currentShotIdx];
  };

  /**
   * Helper: Get visible scenes based on filter mode and deleted indices
   * @returns {array} Array of visible scene objects with indices
   */
  const getVisibleScenes = () => {
    const deletedSet = new Set(_state.deletedIndices);
    const favoriteSet = _state.filterMode === 'favorites'
      ? new Set(_state.favoriteIndices)
      : null;
    const visible = [];

    _state.scenes.forEach((scene, idx) => {
      if (deletedSet.has(idx)) return;
      if (favoriteSet && !favoriteSet.has(idx)) return;

      visible.push({
        ...scene,
        originalIdx: idx,
      });
    });

    return visible;
  };

  return {
    get,
    getState,
    setState,
    resetState,
    onStateChange,
    hasVideo,
    getCurrentScene,
    getVisibleScenes,
  };
})();
