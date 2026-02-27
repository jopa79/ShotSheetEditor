# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Security
- Replace `eval()` with safe `parseFraction()` for ffprobe frame rate parsing (#16)
- Replace `execSync` with `execFileSync` to prevent shell injection (#18)
- Add path traversal protection to FRAME_GET_THUMB handler (#17)
- Add Content-Security-Policy meta tag (#13)
- Replace `innerHTML` with `textContent` to prevent XSS (#13)
- Add IPC input validation for all handlers (strings, numbers, arrays, thumbSize) (#28, #46)
- Add `will-navigate` prevention and popup handler in Electron window (#29)

### Fixed
- Fix `scene.time` → `scene.startTime` property name across all modules (#3)
- Fix `getThumb` IPC signature and implement batch frame extraction workflow (#4)
- Fix `gridSize` string-to-number mapping with `sizeMap` (#5)
- Remove unsafe `unlinkSync` before atomic `renameSync` in projectManager (#6)
- Fix toast container ID mismatch (`toastContainer` → `toastsContainer`) (#10)
- Fix play button ID mismatch (`#playButton` → `#btnPlayPause`) (#22)
- Fix selection bar button bindings to match HTML element IDs (#23)
- Implement actual `saveProject` replacing stub that faked success (#24)
- Remove double-Promise wrapping in IPC handlers (#26)
- Fix `const` in `switch-case` without block scope in shortcuts.js (#47)
- Deduplicate scene timestamps in scene detector (#8)
- Remove duplicate `VideoPlayer.loadVideo` calls (#9)
- Report 100% progress before resolving in frameExtractor (#53)
- Cancel ongoing scene detection before starting new one (#43)
- Validate drag & drop file extensions against supported formats (#12)

### Changed
- Replace `readFileSync` with async `fs.promises.readFile` in FRAME_GET_THUMB (#50)
- Deduplicate `formatTimecode` into shared `utils.js` (renderer) and `constants.js` (main) (#48)
- Optimize `getVisibleScenes` from O(n²) to O(n) using Set (#52)
- Cancel scene detection process on app quit (#14)

### Added
- Drag & drop cleanup function to prevent memory leaks (#11)
- `SelectionManager.cleanup()` for state listener removal (#11)
- README.md with setup instructions and architecture overview (#15)
- This CHANGELOG.md (#15)
