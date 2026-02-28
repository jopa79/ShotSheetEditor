// IPC Channels - all communication channels between main and renderer
const IPC_CHANNELS = {
  // Video operations
  VIDEO_OPEN: 'video:open',
  VIDEO_GET_META: 'video:getMeta',

  // Scene detection
  SCENE_DETECT: 'scene:detect',
  SCENE_DETECT_PROGRESS: 'scene:detectProgress',
  SCENE_DETECT_CANCEL: 'scene:detectCancel',

  // Frame extraction
  FRAME_EXTRACT_BATCH: 'frame:extractBatch',
  FRAME_EXTRACT_PROGRESS: 'frame:extractProgress',
  FRAME_GET_THUMB: 'frame:getThumb',

  // Project management
  PROJECT_NEW: 'project:new',
  PROJECT_OPEN: 'project:open',
  PROJECT_SAVE: 'project:save',

  // Export operations
  EXPORT_SEQUENCE: 'export:sequence',
  EXPORT_SEQUENCE_PROGRESS: 'export:sequenceProgress',
  EXPORT_ZIP: 'export:zip',
  EXPORT_SELECT_DIR: 'export:selectDir',

  // Theme
  THEME_TOGGLE: 'theme:toggle',
  THEME_CHANGED: 'theme:changed',
  THEME_GET: 'theme:get',

  // Application
  APP_GET_VERSION: 'app:getVersion',
  APP_CONFIRM_QUIT: 'app:confirmQuit',

  // Dialogs
  DIALOG_OPEN_VIDEO: 'dialog:openVideo',
  DIALOG_UNSAVED_CHANGES: 'dialog:unsavedChanges',

  // Menu (Main → Renderer)
  MENU_ACTION: 'menu:action',

  // App lifecycle (Main → Renderer)
  APP_BEFORE_QUIT: 'app:beforeQuit',

  // Proxy transcoding
  PROXY_GENERATE: 'proxy:generate',
  PROXY_GENERATE_PROGRESS: 'proxy:generateProgress',
  PROXY_CANCEL: 'proxy:cancel',
};

// Window defaults
const WINDOW_DEFAULTS = {
  width: 1280,
  height: 800,
  minWidth: 900,
  minHeight: 600,
};

// Scene detection defaults and thresholds
const DETECTION_DEFAULTS = {
  threshold: 0.3,
  minThreshold: 0.05,
  maxThreshold: 0.9,
};

// Thumbnail dimensions
const THUMB_SIZE = {
  width: 320,
  height: 180,
};

// Supported video formats
const SUPPORTED_FORMATS = ['.mp4', '.mov', '.mkv', '.avi', '.mxf', '.webm'];

// Export codec presets
const EXPORT_CODECS = {
  PRORES: {
    name: 'ProRes 422 HQ',
    extension: '.mov',
    args: ['-c:v', 'prores_ks', '-profile:v', '3', '-c:a', 'pcm_s16le', '-f', 'mov'],
  },
  H264: {
    name: 'H.264 (MP4)',
    extension: '.mp4',
    args: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'aac', '-f', 'mp4'],
  },
};

// Proxy-Transkodierung: Codecs die Chromium nativ abspielen kann
const PROXY_CONFIG = {
  BROWSER_COMPATIBLE_CODECS: ['h264', 'vp8', 'vp9', 'av1'],
  BROWSER_COMPATIBLE_CONTAINERS: ['.mp4', '.webm'],
  VIDEO_FILTER: 'scale=-2:720',
  PIX_FMT: 'yuv420p', // Chromium unterstützt nur yuv420p — ProRes/HEVC liefern oft 422/10bit
  PRESET: 'ultrafast',
  CRF: '28',
  TEMP_DIR_NAME: 'shotsheet-proxies',
};

// Convert seconds to timecode HH:MM:SS.mmm (for ffmpeg/main-process use)
function secondsToTimecode(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs.toFixed(3)).padStart(6, '0')}`;
}

// Auto-save interval (5 minutes)
const AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000;

// Quit timeout safety (5 seconds)
const QUIT_TIMEOUT_MS = 5000;

module.exports = {
  IPC_CHANNELS,
  WINDOW_DEFAULTS,
  DETECTION_DEFAULTS,
  THUMB_SIZE,
  SUPPORTED_FORMATS,
  EXPORT_CODECS,
  PROXY_CONFIG,
  AUTO_SAVE_INTERVAL_MS,
  QUIT_TIMEOUT_MS,
  secondsToTimecode,
};
