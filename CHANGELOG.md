# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- dialogManager: Alle Dialog-Funktionen akzeptieren optionalen `parentWindow` Parameter fuer macOS Sheet-Modals (#164)
- videoActions/shortcuts: `register*`-Funktionen akzeptieren `null` zum sauberen Deregistrieren

### Fixed
- proxyGenerator: Race Condition — laufendes Transcoding wird vor neuem Prozess abgebrochen (#122)
- VideoPlayer: Memory Leak — Cleanup nullt globale Refs statt No-Op-Funktionen zu registrieren (#93)
- windowManager: `cleanupWindowState()` wird bei App-Quit aufgerufen — verhindert Timer-Leak (#158)

### Security
- Symlink-Bypass: `path.resolve()` durch `fs.realpathSync()` ersetzt in EXPORT_SEQUENCE, PROJECT_OPEN, PROXY_GENERATE, exportManager und proxyGenerator (#88)

### Removed
- exportManager: Dead-Code-Funktion `isPathInsideBase()` entfernt (#159)

### Added
- Grid Aspect Ratio: Shot-Karten respektieren das Video-Seitenverhältnis per CSS `aspect-ratio`
- ShotGrid: `_updateCardClasses()` für differential CSS-Updates ohne DOM-Rebuild (#68, #82)
- InfoPanel: `AbortController`-Pattern stellt sicher dass DOM-Listener bei re-render bereinigt werden (#152, #153)
- shotGrid `updateThumbnail`: Pfad-Validierung gegen gefährliche Protokoll-Injections (#119)
- Progressive Thumbnails: Thumbnails erscheinen sofort nach Erkennung einer Szene — Queue-basierte Extraktion parallel zur Scene Detection (ThumbnailQueue)
- Progressive Thumbnails: Thumbnails erscheinen einzeln während der Extraktion statt erst am Ende
- Collections: Szenen in benannte Sammlungen gruppieren, filtern und verwalten (Scene Info Panel)
- Selection → Collection: Selektierte Shots per Button oder Context Menu einer Collection zuweisen
- Frame Deletion UX: Gelöschte Karten erscheinen ausgegraut, Einzelshot-Löschung per Context Menu
- FFmpeg Transcoding Proxy: Videos mit inkompatiblen Codecs (ProRes, HEVC, MXF, DivX) werden automatisch zu H.264 720p transkodiert
- Proxy-Caching: Bereits transkodierte Videos werden per MD5-Hash wiederverwendet
- Progress-Overlay mit Cancel-Button während Transcoding
- Drag & Drop nutzt jetzt den gleichen Codec-Check-Flow wie "Open Video"
- Automatische Proxy-Bereinigung beim Beenden der App
- Drag & drop cleanup function to prevent memory leaks (#11)
- `SelectionManager.cleanup()` for state listener removal (#11)
- README.md with setup instructions and architecture overview (#15)
- This CHANGELOG.md (#15)

### Changed
- ShotGrid: `selectedIndices`, `favoriteIndices`, `deletedIndices` Änderungen lösen keinen DOM-Rebuild mehr aus — nur CSS-Updates (#68, #82)
- ffmpegBridge: FFmpeg/FFprobe-Pfad wird gecacht um wiederholte `execFileSync`-Aufrufe zu vermeiden (#69, #107)
- formatTimecode: Unterstützt jetzt beliebige FPS als optionalen Parameter statt hardcoded 30 fps (#94)
- UndoRedo: `commit()` wird in allen State-Mutationen vor `setState()` aufgerufen (#87)
- AppState `getState()`: Gibt tiefe Kopien aller Arrays zurück um direkte Mutationen zu verhindern (#127)
- VideoPlayer: Named Event Listener statt anonymer Callbacks für saubere Cleanup-Unterstützung (#93)
- SelectionManager: Button-Listener werden in `_boundListeners` verfolgt und in `cleanup()` entfernt (#100)
- CollectionManager: `UndoRedo.commit()` vor `setState()` in allen CRUD-Funktionen (#123)
- Video-Ladeflow prüft jetzt Codec-Kompatibilität bevor das Video im Player geladen wird
- Drag & Drop delegiert an `Toolbar.openVideoFromPath()` statt eigener Logik
- VideoPlayer: `videoPath` State-Listener entfernt (verhindert Doppel-Load bei Proxy-Verwendung)
- Replace `readFileSync` with async `fs.promises.readFile` in FRAME_GET_THUMB (#50)
- Deduplicate `formatTimecode` into shared `utils.js` (renderer) and `constants.js` (main) (#48)
- Optimize `getVisibleScenes` from O(n²) to O(n) using Set (#52)
- Cancel scene detection process on app quit (#14)

### Fixed
- ShotGrid: State-Listener für Selections/Favorites/Deleted rufen `_updateCardClasses()` statt `renderGrid()` (#68, #82)
- InfoPanel: Event-Listener-Leak bei wiederholtem `render()` — AbortController bricht alte Listener ab (#152, #153)
- FRAME_GET_THUMB: Symlink-Bypass verhindert durch `fs.realpathSync()` statt `path.resolve()` (#88)
- FRAME_GET_THUMB: PNG-Thumbnails werden korrekt als `image/png` geliefert statt `image/jpeg` (#91)
- EXPORT_ZIP: Progress-Callback wurde nie aufgerufen — nutzt jetzt `archive.on('progress', ...)` (#92)
- EXPORT_ZIP: Falsch gesendeter IPC-Channel korrigiert zu `EXPORT_ZIP_PROGRESS` (#106)
- EXPORT_SEQUENCE: Duration-Validierung (endTime muss > startTime sein) (#129)
- sceneDetector: Race Condition beim parallelen Starten von Detektionen durch lokale `proc`-Referenz behoben (#121)
- sceneDetector: Abgebrochene Detektion wird korrekt als `canceled` statt als Fehler gemeldet (#114)
- ffmpegBridge: Windows `where`-Befehl lieferte mehrzeiligen Output — nur erste Zeile wird genutzt (#157)
- windowManager: `ready-to-show`-Timeout verhindert dauerhaft verstecktes Fenster (#102)
- windowManager: Gespeicherte Fensterposition wird gegen Display-Grenzen validiert (#113)
- index.js: IPC-Handler werden auf macOS `activate` nur einmal registriert (#171)
- videoPlayer: `loadVideo()` pausiert das alte Video bevor die neue src gesetzt wird (#147)
- videoPlayer: Direkte State-Mutation in `_extractThumbsForScenes()` durch immutables Map-Pattern ersetzt (#143)
- toolbar: `openVideoFromPath()` prüft nach jedem `await` ob videoPath noch gültig ist (#125)
- toolbar: `isDirty`-Flag wird nach erfolgreicher Scene-Detection gesetzt (#98, #130)
- toolbar: Guard in `_handleThresholdCommit()` verhindert parallele Detektionen (#126)
- selectionManager: `selectRange()` filtert gelöschte Shots korrekt aus (#148)
- app.js: Context-Menu `closeMenu()` prüft auf `null` bevor `contains()` aufgerufen wird (#89)
- app.js: `file:new` prüft `isDirty`-Flag und zeigt Bestätigungsdialog (#131)
- app.js: Transcoding-State-Listener werden in `_transcodingCleanups` gespeichert und in `cleanup()` entfernt (#132)
- app.js: Context-Menu-Position wird an Viewport-Grenzen geclamppt (#163)
- app.js: `dragleave`-Handler prüft `relatedTarget` korrekt (#85)
- shortcuts.js: `_isInitialized`-Guard verhindert Keydown-Events vor Initialisierung (#169)
- shortcuts.js: `Delete`/`Backspace` und `Space` werden in offenen Modals blockiert (#124, #136)
- shortcuts.js: V-Shortcut setzt `activeCollectionId: null` wenn Collection-Filter aktiv (#137)
- Fix thumbnail index in progressive extraction: `task.index` (Queue-Position) → `task.scene.index` (Szenen-Index), sodass Grid-Kacheln Thumbnails korrekt anzeigen
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

### Security
- ipcHandlers: Path-Traversal-Schutz für EXPORT_SEQUENCE, PROJECT_OPEN, PROXY_GENERATE, FRAME_GET_THUMB (#86, #117, #118, #120)
- ipcHandlers: VIDEO_OPEN setzt `needsProxy`-Flag im Main-Prozess als Single Source of Truth (#128)
- exportManager: Path-Traversal-Schutz für videoPath und outputPath (#117)
- proxyGenerator: Path-Traversal-Schutz für inputPath (#120)
- ffmpegBridge: Integer-Cast in `-vf scale` Filter verhindert Injection über `thumbSize` (#112)
- shotGrid `updateThumbnail`: Validierung blockt Protokoll-Injections (#119)
- Replace unsafe `parseFraction()` for ffprobe frame rate parsing (#16)
- Replace `execSync` with `execFileSync` to prevent shell injection (#18)
- Add path traversal protection to FRAME_GET_THUMB handler (#17)
- Add Content-Security-Policy meta tag (#13)
- Replace `innerHTML` with `textContent` to prevent XSS (#13)
- Add IPC input validation for all handlers (strings, numbers, arrays, thumbSize) (#28, #46)
- Add `will-navigate` prevention and popup handler in Electron window (#29)

## [1.0.0] - 2026-02-27

### Added
- Initiales Release
