# ShotSheet Editor

Video scene detection and shot management tool built with Electron.

ShotSheet Editor automatically detects scene changes in video files using FFmpeg, displays them in a grid of thumbnails, and lets you curate, favorite, and export shots.

## Prerequisites

- **Node.js** >= 18
- **FFmpeg** installed and available in `PATH`
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `sudo apt install ffmpeg`
  - Windows: download from https://ffmpeg.org/download.html

## Getting Started

```bash
# Install dependencies
npm install

# Launch the app
npm start
```

## Project Structure

```
src/
  main/               # Electron main process
    index.js           # App entry point, menu, quit flow
    windowManager.js   # BrowserWindow creation, theme, window state
    ipcHandlers.js     # IPC channel handlers (renderer <-> main)
    sceneDetector.js   # FFmpeg-based scene change detection
    frameExtractor.js  # Thumbnail extraction from video
    videoManager.js    # Video metadata via ffprobe
    ffmpegBridge.js    # FFmpeg/ffprobe path resolution
    projectManager.js  # Project file save/load (.shotsheet JSON)
    exportManager.js   # Sequence & ZIP export
    dialogManager.js   # Native file/save dialogs
  renderer/            # Electron renderer process
    index.html         # Main UI
    preload.js         # Context bridge (IPC exposure)
    css/               # Stylesheets (tokens, layout, components)
    js/
      app.js           # App bootstrap, drag & drop, modals, toasts
      state.js         # Centralized state management
      undoRedo.js      # Undo/redo stack
      shotGrid.js      # Shot card grid with virtual scrolling
      videoPlayer.js   # Video playback and timecode display
      selectionManager.js  # Shot selection, favorites, deletion
      toolbar.js       # Toolbar button handlers
      shortcuts.js     # Keyboard shortcuts
      ipc.js           # IPC wrapper for renderer
      utils.js         # Shared utilities (formatTimecode)
  shared/
    constants.js       # IPC channels, defaults, shared utilities
```

## Key Features

- Automatic scene detection with adjustable threshold
- Thumbnail grid with virtual scrolling
- Shot selection (click, shift-range, ctrl-toggle)
- Favorite and delete shots
- Undo/redo support
- Keyboard shortcuts for all major actions
- Light/dark theme toggle
- Project save/load
- Export as ProRes/H.264 sequence or ZIP of thumbnails

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl/Cmd+O` | Open video |
| `Ctrl/Cmd+S` | Save project |
| `Ctrl/Cmd+A` | Select all |
| `Ctrl/Cmd+Z` | Undo |
| `Ctrl/Cmd+Shift+Z` | Redo |
| `Escape` | Deselect all |
| `Delete` | Delete selected |
| `F` | Toggle favorite |
| `I` | Invert selection |
| `V` | Toggle favorites filter |
| `Space` | Play/pause |
| `Arrow Left/Right` | Previous/next shot |
| `1-4` | Grid size S/M/L/XL |

## License

MIT
