# Architektur-Deepening-Initiative — Plan

> Ziel: Shallow modules → deep modules. Verhalten hinter kleiner Schnittstelle bündeln,
> an sauberen Seams platzieren, durch die Schnittstelle testbar machen.
> Vokabular nach `codebase-design`: **deep module** = kleine Interface + viel Implementierung,
> Leverage für Caller, Locality für Maintainer, Interface = Test-Surface.
>
> Stand: 2026-06-19 · Erstellt von: planer · Quelle: 3 Explore-Läufe + grep-Verifikation + Re-Verifikation gegen Kerndateien.

---

## 0. Verifikations-Ergebnis (Claims gegen Code geerdet)

| # | Kandidat | Claim-Status | Korrektur/Nuance |
|---|----------|--------------|------------------|
| 1 | Path-Security-Modul | **BESTÄTIGT** | Pattern `realpathSync` + `startsWith(homeDir+sep)` 14× über 6 Dateien. **3 Varianten** existieren: (a) `home+sep` only (projectManager 2×, ipcHandlers PROJECT_OPEN, FRAME thumb für read), (b) `home+sep \|\| tmp+sep` (proxy/export/extract read), (c) **`home \|\| tmp` OHNE sep** — `protocolHandler.ts:44` = echter Security-Bug (Präfix-Match: `/Users/joachim-evil` matcht gegen `/Users/joachim`). |
| 2 | FFmpeg-Job-Modul | **BESTÄTIGT** | `proxyGenerator.ts` (`let transcodingProcess`), `sceneDetector.ts` (`let detectionProcess` + `_cancelRequested`), `frameExtractor.ts` spawnt bis zu 5× **OHNE jegliches Tracking** → bei App-Crash/Quit orphaned ffmpeg-Prozesse. `ffmpegBridge.ts` macht nur Pfad-Lookup (bleibt). |
| 3 | withUndo() | **KORRIGIERT** | Tatsächlich **11 `commit()`-Call-Sites über 2 Dateien** (selectionActions: 6, collectionActions: 5), NICHT "23 über 6". Die anderen 4 Dateien (videoActions, shortcuts, projectActions, detectionActions) importieren `undoRedo` nur für `undo/redo/clear/canUndo` — **kein `commit()`**. Blast-Radius deutlich kleiner als angenommen. Invariante „commit() VOR setState" nur per Kommentar (`Fix #87`, `Fix #123`). |
| 4 | DetectionOrchestrator | **PRÄZISIERT** | Run-Logik in `detectionActions.detectScenes()` (Reset+invoke+merge), `listeners.ts` (`registerDetectNewScenesHandler`), `thumbnailQueue.ts` (enqueue/merge), `App.svelte:90-110` (Verdrahtung der Callbacks). App.svelte enthält **keine** Detection-Geschäftslogik, nur Callback-Wiring → Orchestrator-Grenze sauber ziehbar. |
| 5 | IPC-Codegen / test-seam | **BESTÄTIGT + erdet** | `bridge.ts` = reines `return api().method(args)` Pass-through (35 Funktionen). **Es existiert KEIN `window.electronAPI`-Mock in `tests/`** → das ist die Wurzel, warum 4 Action-Module ungetestet sind. Ziel ist test-seam, nicht weniger Code. |
| 6 | QueuedExtractor | **BESTÄTIGT** | `thumbnailQueue.ts`: 4 globale `let` (queue, thumbPathMap, isProcessing, currentVideoPath) + mechanischer Race-Guard (videoPath-Vergleich nach `await`). |
| 7 | ActionContext (DI) | **BESTÄTIGT** | Alle Action-Module importieren statisch `../stores` + `../ipc/bridge`. 4/10 ungetestet (videoActions, detectionActions, exportActions, thumbnailQueue) — kausal verknüpft mit #5 (kein IPC-Mock). |

**Kleinere frictions** (alle bestätigt):
- `Toolbar.svelte:94` ruft `await ipc.toggleTheme()` direkt → bricht „nur Actions, nie IPC". Quick-Fix via neuem `themeActions.toggleTheme()`.
- 6 Stores getter/setter-Paare → Konsolidierung zu Domain-Modulen (Worth exploring, niedrige Priorität).
- Collection-menu/toast-Logik dupliziert in `InfoPanel.svelte` + `ShotCard.svelte`; `collectionActions` meldet keinen Erfolg zurück.
- Undo deep-clone via `JSON.parse(JSON.stringify())` bei jedem commit (Speculative, nur bei Perf-Problem angehen).

---

## 1. Dependency-Graph

```
MAIN-PROCESS (Renderer-unabhängig, parallel zueinander möglich):
  #1 Path-Security ──────────────┐
       │ (validateForRead/Write)  │ konsumiert von #2? nein, unabhängig.
       │                          │
  #2 FFmpeg-Job-Modul ───────────┘   (proxy/scene/frame nutzen Job-Manager)
  Toolbar-Quick (#TB) — eigenständig, Renderer, winzig

RENDERER-PROCESS (geteilte action-Dateien → Konflikt-Risiko):
  #5 IPC test-seam (fake-bridge) ──► ENABLER für #7
       │
  #7 ActionContext (DI) ──────────► berührt ALLE action-Dateien
       │  ▲                          (videoActions, detectionActions, …)
       │  │ teilt Dateien mit:
  #3 withUndo() ───────────────────► berührt selectionActions + collectionActions
       │  │
  #6 QueuedExtractor ──────────────► berührt thumbnailQueue.ts
       │  │
  #4 DetectionOrchestrator ────────► berührt detectionActions, listeners,
                                       thumbnailQueue, App.svelte
                                       (KONSUMIERT #6 QueuedExtractor)
```

**Konflikt-Matrix (gemeinsam berührte Dateien):**

| Kandidat | Berührt Dateien | Kollidiert mit |
|----------|-----------------|----------------|
| #1 | ipcHandlers, proxyGenerator, exportManager, projectManager, protocolHandler + neues `pathSecurity.ts` | — (Main-only) |
| #2 | proxyGenerator, sceneDetector, frameExtractor + neues `ffmpegJobManager.ts` | #1 (proxyGenerator gemeinsam — aber andere Code-Region: Path-Check vs spawn) |
| #3 | selectionActions, collectionActions, undoRedo | #7 (gleiche Dateien), #4 (collection/selection nicht, aber Risiko) |
| #4 | detectionActions, listeners, thumbnailQueue, App.svelte + neuer `detectionOrchestrator.ts` | #6 (thumbnailQueue), #7 (detectionActions) |
| #5 | bridge.ts, neues `tests/helpers/fakeIpc.ts` | — (additiv, kein Konflikt) |
| #6 | thumbnailQueue.ts | #4 (gleiche Datei) |
| #7 | ALLE action-Dateien | #3, #4, #6 (alle) |
| #TB | Toolbar.svelte, neuer themeActions | — |

**Schlüssel-Abhängigkeiten:**
- **#5 blockiert #7** (test-seam muss existieren, bevor DI-Tests geschrieben werden können).
- **#6 sollte vor #4** kommen (Orchestrator konsumiert den deepened Extractor — sonst doppelte Migration der thumbnailQueue).
- **#7 ist der „großer Hammer"-Task** — berührt alle action-Dateien, also entweder zuerst (alle anderen bauen darauf) oder zuletzt (sammelt die bereits deepened Module ein). Siehe Designfrage D1.

---

## 2. Phasenreihenfolge (mit Begründung)

### Phase A — Critical / High Leverage, Main-Process, konfliktarm (PARALLEL)
Reine Main-Process-Arbeit, unabhängig vom Renderer, höchster Sicherheits-/Stabilitäts-Hebel.

- **#1 Path-Security-Modul** — behebt **echten Security-Bug** (protocolHandler), 14 Duplikate → 1 deep module. Höchste Locality-Auszahlung.
- **#2 FFmpeg-Job-Modul** — behebt **orphaned-process-Bug** (frameExtractor ohne Tracking). Stabilität.
- **#TB Toolbar-Quick** — winziger Architektur-Konsistenz-Fix, parallel mitlaufen lassen.

> **Worktree:** #1 und #2 teilen `proxyGenerator.ts` (verschiedene Regionen). Empfehlung: **getrennte Worktrees**, Merge-Reihenfolge #1 → #2, da #2 den Path-Check in proxyGenerator durch `validateForWrite/Read` ersetzen *könnte* (optional, siehe D3). Wenn #2 den Path-Check NICHT anfasst → echte Parallelität ohne Worktree-Konflikt.

### Phase B — Test-Enabler (SEQUENZIELL vor C)
- **#5 IPC test-seam** — additiv, kein Konflikt, **schaltet Testbarkeit für #7 frei**. Klein, hoher Hebel. Muss vor #7-Tests stehen.

### Phase C — Renderer Deep-Modules, geteilte Dateien (SEQUENZIELL, sorgfältige Reihenfolge)
Reihenfolge minimiert Konflikte in den geteilten action-Dateien:

1. **#3 withUndo()** — kleinster Blast-Radius (nur selectionActions + collectionActions), macht Invariante struktur-erzwungen. Zuerst, weil es 11 Call-Sites *vereinfacht*, die #7 danach anfassen muss → weniger DI-Verdrahtung.
2. **#6 QueuedExtractor** — isoliert auf thumbnailQueue.ts, deepened den Extractor **bevor** #4 ihn konsumiert.
3. **#4 DetectionOrchestrator** — konsumiert #6, zieht Detection-Logik aus App.svelte/listeners/detectionActions in einen deep module.
4. **#7 ActionContext (DI)** — **zuletzt**, sammelt die bereits deepened Module (#3 withUndo, #6 Extractor, #4 Orchestrator) hinter `ActionContext{stores,ipc,toast,undo}` ein. Profitiert von #5 (fakeIpc) für die dann erst möglichen Tests der 4 ungetesteten Module. (Alternative Reihenfolge → Designfrage D1.)

### Phase D — Worth exploring / Speculative (BACKLOG, nicht Teil dieser Welle)
- Store-Konsolidierung 6→3 (niedrige Priorität, hohes Regressionsrisiko, geringer Hebel).
- Collection-Duplizierung InfoPanel/ShotCard + Erfolgs-Rückmeldung aus collectionActions.
- Undo structured-clone statt JSON (nur bei gemessenem Perf-Problem).

**Begründung der Gesamtreihenfolge:** Risiko-zuerst (Security #1, Stabilität #2), dann Enabler (#5), dann Renderer von „kleinster Blast-Radius" zu „berührt alles" (#3 → #6 → #4 → #7), damit jeder spätere Task auf bereits-deepened, bereits-getesteten Modulen aufsetzt statt sie parallel umzuwälzen.

---

## 3. Kandidaten im Detail

> Test-Strategie durchgängig **TDD RED-GREEN-REFACTOR** (`superpowers:test-driven-development`).
> Akzeptanz durchgängig: `npm test` grün · `npx tsc --noEmit` sauber · `npm run dev` startet ohne Regression.

### #1 — Path-Security-Modul `[M]`
- **Seam/Interface:** Neues `src/main/pathSecurity.ts`. Deep module mit kleiner Interface:
  `validateForRead(p: string): string` (realpath + allow home∪tmp) und
  `validateForWrite(dir: string): string` (realpath dirname + allow). Wirft typisierten `PathSecurityError` oder gibt aufgelösten Pfad zurück.
- **Betroffene Dateien:** `ipcHandlers.ts` (6 Stellen), `proxyGenerator.ts` (1), `exportManager.ts` (3), `projectManager.ts` (3 — Achtung: nur `home`, kein tmp → eigener `validateForReadHomeOnly` oder Param `allowTmp=false`), `protocolHandler.ts` (1, **Bug-Fix** `+path.sep`). Neu: `pathSecurity.ts`.
- **Test (RED→GREEN):** Unit-Tests gegen `pathSecurity.ts`: erlaubt Pfad in home/tmp; lehnt Pfad außerhalb ab; **lehnt Präfix-Angriff `/Users/joachim-evil` ab** (deckt protocolHandler-Bug ab); lehnt nicht-existenten Pfad ab (realpath wirft); Symlink-Escape wird via realpath aufgelöst. Diese Tests sind reines Node, kein Electron-Mock nötig.
- **Regressions-Risiko:** MITTEL — alle Path-Checks ersetzen. `projectManager` ist home-only (Variante a) — darf nicht versehentlich tmp erlauben. Akzeptanzkriterium muss home-only-Pfad explizit prüfen.
- **Akzeptanz:** Alle bestehenden ipc-Path-Tests grün; neuer Präfix-Angriff-Test grün; grep zeigt 0 verbleibende inline `startsWith(homeDir` außerhalb `pathSecurity.ts`.

### #2 — FFmpeg-Job-Modul `[L]`
- **Seam/Interface:** Neues `src/main/ffmpegJobManager.ts`. Deep module:
  `startJob(type: 'proxy'|'detect'|'extract', args: string[], opts?: {onProgress?, onStderr?}): JobHandle`
  mit `JobHandle { promise: Promise<{code}>, kill(): void }`. Manager hält Registry aller laufenden Jobs → `killAll()` für App-Quit.
- **Betroffene Dateien:** `proxyGenerator.ts` (entfernt `let transcodingProcess`), `sceneDetector.ts` (entfernt `let detectionProcess` + `_cancelRequested`), `frameExtractor.ts` (5 spawns → tracked Jobs). `index.ts`/quit-Handler ruft `killAll()`. `ffmpegBridge.ts` bleibt (Pfad-Lookup). Neu: `ffmpegJobManager.ts`.
- **Test (RED→GREEN):** Manager-Tests mit gemocktem `spawn` (vi.mock child_process): Job startet, `kill()` sendet SIGTERM, `killAll()` killt alle, Registry wird bei `close` geleert, concurrent extract-Jobs (5) alle getrackt. stderr-Parsing bleibt domänenspezifisch in den Callern (Manager liefert nur rohen stderr-Stream via `onStderr`).
- **Regressions-Risiko:** HOCH — berührt alle 3 ffmpeg-Pfade inkl. der bestehenden Race-Fixes (#121, #122, #114, #125). Bestehende Cancel-Semantik (proxy bricht laufendes ab, detect `_cancelRequested`) muss erhalten bleiben. **Devils-advocate-Review zwingend.**
- **Akzeptanz:** Detection/Proxy/Extract funktionieren in `npm run dev`; manueller Test: App während Detection schließen → kein orphaned ffmpeg (`ps aux | grep ffmpeg` leer); Cancel während Proxy/Detection bricht sauber ab.

### #3 — withUndo() `[S]`
- **Seam/Interface:** Erweitere `undoRedo.ts` um `withUndo<T>(fn: () => T): T` — nimmt Snapshot (commit), führt `fn` aus, gibt Resultat zurück. Macht Invariante „commit VOR setState" strukturell unmöglich zu brechen.
- **Betroffene Dateien:** `undoRedo.ts` (+1 Funktion), `selectionActions.ts` (6 Sites), `collectionActions.ts` (5 Sites). Jede `commit(); …mutation…` wird zu `withUndo(() => { …mutation… })`.
- **Test (RED→GREEN):** `undoRedo.test.ts` existiert bereits → erweitern: `withUndo` legt Snapshot an, führt fn aus, `undo()` stellt Pre-fn-State wieder her; wenn fn wirft → Stack-Konsistenz (Snapshot bleibt/wird zurückgerollt — Designfrage D2). Action-Tests (selectionActions/collectionActions existieren) prüfen unverändertes Verhalten.
- **Regressions-Risiko:** NIEDRIG-MITTEL — mechanische Umstellung, aber falsches fn-Closure könnte Mutation außerhalb des Snapshots lassen. Reihenfolge vor #7 reduziert spätere DI-Arbeit.
- **Akzeptanz:** `undoRedo.test.ts` + `selectionActions.test.ts` + `collectionActions.test.ts` grün; grep zeigt 0 nackte `undoRedo.commit()` in Action-Dateien.

### #4 — DetectionOrchestrator `[L]`
- **Seam/Interface:** Neues `src/renderer/src/lib/actions/detectionOrchestrator.ts`. Deep module:
  `run(videoPath: string, threshold: number): Promise<DetectionResult>` kapselt: State-Reset → `ipc.detectScenes` → progressive Szenen-Append → Thumbnail-Enqueue (via #6) → Merge → Toast. `cancel()`.
- **Betroffene Dateien:** `detectionActions.ts` (wird dünn, delegiert an Orchestrator), `listeners.ts` (Callback-Wiring zieht in Orchestrator), `thumbnailQueue.ts`/#6 (konsumiert), `App.svelte:90-110` (Wiring entfällt/vereinfacht). Neu: `detectionOrchestrator.ts`.
- **Test (RED→GREEN):** Mit `fakeIpc` (#5): `run()` mit Fake-Detection-Response → erwartete Szenen im Store, Thumbnails enqueued, Toast-Calls. `cancel()` stoppt sauber. **Blockiert von #5 + #6.**
- **Regressions-Risiko:** HOCH — progressive Detection + Race-Guards (Fix #114, #121, #125) müssen erhalten bleiben. Das Callback-Register-Pattern (`registerDetectNewScenesHandler`) ist subtil.
- **Akzeptanz:** Detection in `npm run dev` zeigt progressive Szenen + Thumbnails wie vorher; Cancel funktioniert; neue Orchestrator-Tests grün.

### #5 — IPC test-seam (fakeIpc) `[S]`
- **Seam/Interface:** `bridge.ts` bleibt (typsicher, gewollt). Neu: `tests/helpers/fakeIpc.ts` — ein In-Memory-Adapter, der `window.electronAPI` (oder ein injizierbares `ipc`-Objekt für #7) mit programmierbaren Responses bereitstellt. **Zwei Adapter (real bridge + fake) = echter Seam** (codebase-design-Heuristik erfüllt).
- **Betroffene Dateien:** Neu `tests/helpers/fakeIpc.ts`. Optional minimaler Touch an `bridge.ts`, falls `api()` injizierbar gemacht wird (Designfrage D4). KEINE Codegen — der Trade-off „heute typsicher" bleibt erhalten.
- **Test (RED→GREEN):** Ein Smoke-Test der zeigt: ein bisher ungetestetes Modul (z.B. `detectionActions`) lässt sich mit `fakeIpc` ohne echtes Electron testen → beweist den Seam.
- **Regressions-Risiko:** SEHR NIEDRIG — additiv, nur Test-Infra.
- **Akzeptanz:** Smoke-Test grün; `fakeIpc` deckt alle 35 bridge-Methoden ab (oder die genutzten).

### #6 — QueuedExtractor `[M]`
- **Seam/Interface:** `thumbnailQueue.ts` → Klasse `ThumbnailExtractor` mit privatem State (queue, thumbPathMap, isProcessing, currentVideoPath) und kleiner Interface: `clear()`, `enqueueAndProcess(scenes)`, `getThumbPaths()`. Singleton-Export für API-Kompatibilität.
- **Betroffene Dateien:** `thumbnailQueue.ts`. Caller (`detectionActions`, `App.svelte`) bleiben kompatibel via gleicher Funktions-Exports (Wrapper auf Singleton).
- **Test (RED→GREEN):** Mit `fakeIpc` (#5): enqueue → process → thumbPathMap gefüllt; Race-Guard (videoPath wechselt nach await → Queue verworfen); merge nach Detection-Ende.
- **Regressions-Risiko:** MITTEL — der Race-Guard ist subtil (videoPath-Vergleich vor+nach await). Muss exakt erhalten bleiben.
- **Akzeptanz:** Thumbnail-Extraktion in `npm run dev` wie vorher; neue Extractor-Tests grün; **vor #4 gemerged**.

### #7 — ActionContext (DI) `[L]`
- **Seam/Interface:** `ActionContext { stores, ipc, toast, undo }` injiziert in Action-Funktionen statt statischer Imports. Macht die 4 ungetesteten Module (videoActions, detectionActions, exportActions, thumbnailQueue) testbar. **Interface = Test-Surface** (codebase-design-Kernprinzip: „accept dependencies, don't create them").
- **Betroffene Dateien:** ALLE Action-Module + Aufrufer (Komponenten). Großer Blast-Radius → **eigener Worktree zwingend.**
- **Test (RED→GREEN):** Mit `fakeIpc` + Fake-Stores: die 4 bisher ungetesteten Module bekommen Erst-Tests. Bestehende Tests (selection/collection/project) müssen grün bleiben.
- **Regressions-Risiko:** HOCH (größter Blast-Radius). **Blockiert von #5.** Sollte nach #3/#6/#4 kommen (sammelt deepened Module ein) — ODER zuerst als Fundament (Designfrage D1, mit User klären).
- **Akzeptanz:** 4 neu-getestete Module mit Coverage; alle bestehenden Tests grün; `npm run dev` ohne Regression.

### #TB — Toolbar-Quick `[XS]`
- **Seam/Interface:** Neu `themeActions.ts` mit `toggleTheme()` (ruft `ipc.toggleTheme`). `Toolbar.svelte:94` ruft `themeActions.toggleTheme()` statt `ipc.toggleTheme()`.
- **Betroffene Dateien:** `Toolbar.svelte`, neu `themeActions.ts` (oder in bestehende uiActions, falls vorhanden).
- **Test:** Trivial; manuell Theme-Toggle in `npm run dev`.
- **Regressions-Risiko:** SEHR NIEDRIG.
- **Akzeptanz:** Theme-Toggle funktioniert; grep zeigt kein `ipc.` mehr in `Toolbar.svelte`.

---

## 4. Offene Designfragen (für User-Klärung durch teamlead)

- **D1 — #7 ActionContext Reihenfolge & Scope:** Zuerst (Fundament, alle bauen darauf) oder zuletzt (sammelt deepened Module ein)? Und: ActionContext als explizites Funktions-Argument (`fn(ctx, …)`) oder als Modul-Level-Injection (`setContext()` beim App-Start)? Ersteres ist testfreundlicher, letzteres weniger invasiv für Caller. **Ist #7 überhaupt Teil dieser Welle oder eine eigene?** Größter Hebel auf Testbarkeit, aber auch größtes Risiko.
- **D2 — #3 withUndo Fehler-Semantik:** Wenn die mutation-fn wirft — Snapshot auf dem Stack lassen (User kann zurück) oder zurückrollen (Atomarität)? Atomar ist sauberer, aber ändert Verhalten ggü. heute (heute: commit ist schon passiert, bevor Mutation crasht).
- **D3 — #1/#2 Überlappung in proxyGenerator:** Soll #2 (FFmpeg-Job) den Path-Check in proxyGenerator durch #1 (`validateForRead`) ersetzen, oder bleiben die Concerns getrennt? Entscheidet über Worktree-Strategie und Merge-Reihenfolge in Phase A.
- **D4 — #5 Seam-Mechanik:** fakeIpc nur als Test-Helper (überschreibt `window.electronAPI`) oder `bridge.ts` so umbauen, dass `api()` injizierbar wird? Letzteres ist sauberer für #7, ersteres minimaler. Hängt mit D1 zusammen.
- **D5 — Wellen-Schnitt:** Ist das die komplette Welle (#1–#7 + #TB) oder nur Phase A+B als „Welle 1" (Security/Stabilität/Enabler), Renderer-Deepening als „Welle 2"? Empfehlung planer: **Welle 1 = #1, #2, #5, #TB** (hoher Hebel, niedriger Renderer-Konfliktradius), **Welle 2 = #3, #6, #4, #7** (sequenziell, geteilte Dateien).

---

## 5. Worktree-Bedarf (Zusammenfassung)

| Phase | Tasks | Worktree |
|-------|-------|----------|
| A | #1, #2 | je eigener Worktree (teilen proxyGenerator); #TB im Haupt-WT |
| B | #5 | Haupt-WT (additiv) |
| C | #3 → #6 → #4 → #7 | **sequenziell**, #7 eigener Worktree (Blast-Radius) |

Parallelisierbar **innerhalb** Phase A: #1 ∥ #2 ∥ #TB. Phase C ist bewusst sequenziell wegen geteilter action-Dateien.
