/**
 * VideoPlayer Module
 * Handles video playback, seeking, and timecode display
 */
const VideoPlayer = (() => {
  let _videoElement = null;
  let _tcDisplayElement = null;
  let _playButtonElement = null;
  let _stateListeners = [];

  /**
   * Format seconds to HH:MM:SS.FF timecode
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted timecode
   */
  const formatTimecode = (seconds) => {
    if (!Number.isFinite(seconds)) {
      return '00:00:00.00';
    }

    const totalFrames = Math.round(seconds * 30); // 30fps
    const frames = totalFrames % 30;
    const totalSeconds = Math.floor(totalFrames / 30);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    return (
      String(hours).padStart(2, '0') +
      ':' +
      String(minutes).padStart(2, '0') +
      ':' +
      String(secs).padStart(2, '0') +
      '.' +
      String(frames).padStart(2, '0')
    );
  };

  /**
   * Load video file
   * @param {string} filePath - Path to video file
   */
  const loadVideo = async (filePath) => {
    if (!_videoElement) return;

    try {
      // Convert file path to file:// protocol URL
      let videoUrl = filePath;
      if (!videoUrl.startsWith('file://') && !videoUrl.startsWith('app://')) {
        videoUrl = 'file://' + (filePath.startsWith('/') ? '' : '/') + filePath;
      }

      _videoElement.src = videoUrl;
      _videoElement.load();

      // Fetch thumbnails for all scenes once video is loaded
      _videoElement.addEventListener(
        'loadedmetadata',
        () => {
          _extractThumbsForScenes();
        },
        { once: true }
      );
    } catch (err) {
      console.error('VideoPlayer: loadVideo failed', err);
      showToast('Failed to load video', 'error');
    }
  };

  /**
   * Extract thumbnails for all scenes via batch extraction,
   * then update scenes with the extracted file paths.
   */
  const _extractThumbsForScenes = async () => {
    const scenes = AppState.get('scenes');
    if (scenes.length === 0) return;

    try {
      const videoPath = AppState.get('videoPath');
      const projectPath = AppState.get('projectPath');
      if (!projectPath) return;

      const outputDir = projectPath + '/thumbnails';

      // Batch extract all frames via the correct IPC channel
      const result = await IPC.extractFrames(videoPath, scenes, outputDir);
      if (!result || !result.success || !result.frames) return;

      // Update scenes with extracted thumbnail paths
      for (const frame of result.frames) {
        if (frame && frame.path != null && frame.index != null && scenes[frame.index]) {
          scenes[frame.index].thumbPath = frame.path;
        }
      }

      AppState.setState({ scenes: [...scenes] });
    } catch (err) {
      console.error('VideoPlayer: _extractThumbsForScenes failed', err);
    }
  };

  /**
   * Seek to specific time
   * @param {number} time - Time in seconds
   */
  const seekTo = (time) => {
    if (!_videoElement) return;

    if (Number.isFinite(time)) {
      _videoElement.currentTime = time;
      updateTcDisplay();
    }
  };

  /**
   * Update timecode display
   */
  const updateTcDisplay = () => {
    if (!_tcDisplayElement || !_videoElement) return;

    const current = formatTimecode(_videoElement.currentTime);
    const duration = formatTimecode(_videoElement.duration);
    _tcDisplayElement.textContent = `${current} / ${duration}`;
  };

  /**
   * Navigate to previous shot
   */
  const prevShot = () => {
    const scenes = AppState.getVisibleScenes();
    const currentIdx = AppState.get('currentShotIdx');

    if (scenes.length === 0) return;

    let newIdx = -1;
    for (let i = 0; i < scenes.length; i++) {
      if (scenes[i].originalIdx < currentIdx) {
        newIdx = scenes[i].originalIdx;
      }
    }

    if (newIdx !== -1) {
      AppState.setState({ currentShotIdx: newIdx });
    }
  };

  /**
   * Navigate to next shot
   */
  const nextShot = () => {
    const scenes = AppState.getVisibleScenes();
    const currentIdx = AppState.get('currentShotIdx');

    if (scenes.length === 0) return;

    for (const scene of scenes) {
      if (scene.originalIdx > currentIdx) {
        AppState.setState({ currentShotIdx: scene.originalIdx });
        return;
      }
    }
  };

  /**
   * Toggle play/pause
   */
  const togglePlayPause = () => {
    if (!_videoElement) return;

    if (_videoElement.paused) {
      _videoElement.play().catch((err) => {
        console.error('VideoPlayer: play failed', err);
      });
    } else {
      _videoElement.pause();
    }
  };

  /**
   * Initialize module
   */
  const init = () => {
    _videoElement = document.querySelector('#videoPlayer');
    _tcDisplayElement = document.querySelector('#tcDisplay');
    _playButtonElement = document.querySelector('#playButton');

    if (!_videoElement) {
      console.error('VideoPlayer: video element not found');
      return;
    }

    // Initialize timecode display if available
    if (_tcDisplayElement) {
      updateTcDisplay();
    }

    // Timeupdate listener for TC display
    _videoElement.addEventListener('timeupdate', () => {
      updateTcDisplay();
    });

    // Play/pause button toggle
    if (_playButtonElement) {
      _playButtonElement.addEventListener('click', togglePlayPause);

      _videoElement.addEventListener('play', () => {
        _playButtonElement.innerHTML = '⏸';
        _playButtonElement.setAttribute('aria-label', 'Pause');
      });

      _videoElement.addEventListener('pause', () => {
        _playButtonElement.innerHTML = '▶';
        _playButtonElement.setAttribute('aria-label', 'Play');
      });
    }

    // State listener for currentShotIdx changes
    const cleanupCurrentIdx = AppState.onStateChange('currentShotIdx', (idx) => {
      if (idx >= 0) {
        const scene = AppState.get('scenes')[idx];
        if (scene) {
          seekTo(scene.startTime);
        }
      }
    });

    // State listener for videoPath changes
    const cleanupVideoPath = AppState.onStateChange('videoPath', (path) => {
      if (path) {
        loadVideo(path);
      }
    });

    _stateListeners = [cleanupCurrentIdx, cleanupVideoPath];
  };

  /**
   * Cleanup module
   */
  const cleanup = () => {
    _stateListeners.forEach((fn) => fn());
    _stateListeners = [];
  };

  return {
    init,
    cleanup,
    loadVideo,
    seekTo,
    updateTcDisplay,
    prevShot,
    nextShot,
    togglePlayPause,
  };
})();
