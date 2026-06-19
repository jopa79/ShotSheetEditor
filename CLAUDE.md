# CLAUDE.md — ShotSheetEditor

## Tech Stack
- **Runtime:** Electron 34 (Chromium + Node.js)
- **Build-Tool:** electron-vite 5 + Vite 7
- **Frontend:** Svelte 5 (Runes, `.svelte.ts` Stores) + TypeScript 5.9
- **Styling:** Vanilla CSS mit Custom Properties (Design Tokens in `tokens.css`)
- **Tests:** Vitest 4
- **Linting:** ESLint 10 + Prettier 3
- **Packaging:** electron-builder 26
- **Dependencies (Runtime):** archiver (ZIP-Export), ffmpeg/ffprobe (gebundelt oder System)

## Projektstruktur
```
src/
  main/              — Electron Main-Process (Node.js)
    index.ts         — App-Lifecycle, Menue, Window-Erstellung
    ipcHandlers.ts   — Alle IPC-Handler (Sicherheits-Grenze)
    ffmpegBridge.ts  — FFmpeg/FFprobe Pfad-Aufloesung + Caching
    frameExtractor.ts — Thumbnail-Extraktion (concurrent, MAX=5)
    exportManager.ts — ZIP + Sequenz-Export
    proxyGenerator.ts — Proxy-Video-Generierung (H.264 720p)
    projectManager.ts — Projekt laden/speichern (Atomic Write)
    sceneDetector.ts — Scene Detection via ffmpeg
    windowManager.ts — BrowserWindow + State-Persistenz
    dialogManager.ts — Native Dialoge (Open/Save/Confirm)
    videoManager.ts  — Video-Metadaten via ffprobe
  preload/           — Context Bridge (Sicherheits-Grenze)
    index.ts         — contextBridge.exposeInMainWorld()
    types.ts         — ElectronAPI Interface-Definition
  renderer/          — Svelte 5 Frontend
    src/
      components/    — Svelte-Komponenten (Grid, Player, Toolbar, etc.)
      lib/
        actions/     — Business-Logik (videoActions, projectActions, etc.)
        ipc/bridge.ts — Typisierter Wrapper um window.electronAPI
        stores/      — Svelte 5 Runes Stores (.svelte.ts)
      App.svelte     — Root-Komponente
      main.ts        — Entry-Point
    index.html       — App-Shell
  shared/            — Von Main + Renderer gemeinsam genutzt
    constants.ts     — Re-Exports aus Submodulen
    ipcChannels.ts   — IPC Channel-Konstanten (as const)
    ipcPayloads.ts   — Request/Response Types fuer alle IPC-Calls
    models.ts        — Domain-Types (Scene, Collection, VideoMeta, etc.)
tests/
  unit/              — Vitest Unit-Tests
docs/                — Architektur-Dokumentation
```

## Wichtige Befehle
```bash
# Entwicklung starten (Hot-Reload)
npm run dev

# TypeScript pruefen (ohne Build)
npx tsc --noEmit

# Tests ausfuehren
npm run test

# Tests im Watch-Modus
npm run test:watch

# Build (alle Plattformen)
npm run build

# macOS DMG bauen
npm run build:mac

# Linting
npm run lint

# Formatierung
npm run format
```

## Architektur-Patterns

### IPC-Schichten (5 Layer)
1. `ipcChannels.ts` — Channel-Strings als `as const`
2. `preload/types.ts` — `ElectronAPI` Interface
3. `preload/index.ts` — `contextBridge.exposeInMainWorld()`
4. `main/ipcHandlers.ts` — Handler mit Validierung + wrapHandler()
5. `renderer/lib/ipc/bridge.ts` — Typisierte Wrapper-Funktionen

Neue IPC-Methode = immer alle 5 Schichten aendern.

### State-Management (Svelte 5 Runes)
- Stores in `lib/stores/*.svelte.ts` mit `$state()` Runes
- Getter/Setter-Funktionen (kein direkter Store-Zugriff)
- `resetAllStores()` fuer File → New
- UndoRedo: `commit()` MUSS vor State-Aenderung aufgerufen werden

### Actions-Pattern
- Business-Logik in `lib/actions/*.ts`
- Actions importieren Stores und IPC-Bridge
- Komponenten rufen nur Actions auf, nie direkt IPC

### Security
- Alle Pfade gegen `os.homedir()` validieren (Path Traversal)
- `fs.realpathSync()` statt `path.resolve()` (Symlink-Schutz)
- Codec gegen Whitelist pruefen
- CSP in index.html

## Projektspezifische Konventionen
- Svelte-Komponenten: PascalCase (`ShotGrid.svelte`)
- Store-Dateien: camelCase mit `.svelte.ts` Extension
- IPC-Channels: `domain:action` Format (`video:open`, `project:save`)
- Alle IPC-Handler muessen in `wrapHandler()` gewrappt werden
- Keine anonymen Event-Listener (fuer Cleanup)

## Agent skills

### Issue tracker

Issues are tracked as GitHub issues in `jopa79/ShotSheetEditor` via the `gh` CLI; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) — each role maps to its own name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
