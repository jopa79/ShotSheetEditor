// IPC Channel-Konstanten — typisiert als `as const` fuer Literal-Types
// WICHTIG: Muessen 1:1 mit constants.js uebereinstimmen (bis Main migriert ist)

export const IPC_CHANNELS = {
  // Video-Operationen
  VIDEO_OPEN: 'video:open',
  VIDEO_GET_META: 'video:getMeta',

  // Scene Detection
  SCENE_DETECT: 'scene:detect',
  SCENE_DETECT_PROGRESS: 'scene:detectProgress',
  SCENE_DETECT_CANCEL: 'scene:detectCancel',

  // Frame-Extraktion
  FRAME_EXTRACT_BATCH: 'frame:extractBatch',
  FRAME_EXTRACT_PROGRESS: 'frame:extractProgress',
  FRAME_GET_THUMB: 'frame:getThumb',

  // Projekt-Verwaltung
  PROJECT_NEW: 'project:new',
  PROJECT_OPEN: 'project:open',
  PROJECT_SAVE: 'project:save',

  // Export
  EXPORT_SEQUENCE: 'export:sequence',
  EXPORT_SEQUENCE_PROGRESS: 'export:sequenceProgress',
  EXPORT_ZIP: 'export:zip',
  EXPORT_ZIP_PROGRESS: 'export:zipProgress',
  EXPORT_SELECT_DIR: 'export:selectDir',

  // Theme
  THEME_TOGGLE: 'theme:toggle',
  THEME_CHANGED: 'theme:changed',
  THEME_GET: 'theme:get',

  // App-Lifecycle
  APP_GET_VERSION: 'app:getVersion',
  APP_CONFIRM_QUIT: 'app:confirmQuit',
  APP_BEFORE_QUIT: 'app:beforeQuit',

  // Dialoge
  DIALOG_OPEN_VIDEO: 'dialog:openVideo',
  DIALOG_UNSAVED_CHANGES: 'dialog:unsavedChanges',

  // Menue (Main -> Renderer)
  MENU_ACTION: 'menu:action',

  // Proxy-Transkodierung
  PROXY_GENERATE: 'proxy:generate',
  PROXY_GENERATE_PROGRESS: 'proxy:generateProgress',
  PROXY_CANCEL: 'proxy:cancel',

  // --- V2.0 Neue Channels ---

  // Whisper Transcription
  TRANSCRIPTION_START: 'transcription:start',
  TRANSCRIPTION_PROGRESS: 'transcription:progress',
  TRANSCRIPTION_CANCEL: 'transcription:cancel',

  // Audio-Extraktion (fuer Whisper + Waveform)
  AUDIO_EXTRACT: 'audio:extract',
  AUDIO_EXTRACT_PROGRESS: 'audio:extractProgress',

  // Waveform-Peaks
  WAVEFORM_GENERATE: 'waveform:generate',

  // AI Text-Analyse
  AI_ANALYZE: 'ai:analyze',
  AI_ANALYZE_PROGRESS: 'ai:analyzeProgress',

  // Clip-Export (ProRes 422)
  CLIP_EXPORT: 'clip:export',
  CLIP_EXPORT_PROGRESS: 'clip:exportProgress',
  CLIP_EXPORT_CANCEL: 'clip:exportCancel',

  // API-Key-Verwaltung (Electron safeStorage)
  API_KEY_SET: 'apiKey:set',
  API_KEY_GET: 'apiKey:get',
  API_KEY_DELETE: 'apiKey:delete',
  API_KEY_HAS: 'apiKey:has',

  // ElevenLabs Cloud-Transcription
  ELEVENLABS_TRANSCRIBE: 'elevenlabs:transcribe',
  ELEVENLABS_PROGRESS: 'elevenlabs:progress',
} as const

// Utility-Type: alle Channel-Strings
export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
