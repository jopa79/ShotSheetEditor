## Phase B (Enabler) — sequenziell VOR #7. Haupt-Worktree (additiv).

**Root Cause:** bridge.ts = 35x reines `return api().method(args)` Pass-through. **Kein window.electronAPI-Mock in tests/** → 4 Action-Module ungetestet (videoActions, detectionActions, exportActions, thumbnailQueue).

**Lösung:** `tests/helpers/fakeIpc.ts` — In-Memory-Adapter mit programmierbaren Responses. Zwei Adapter (real bridge + fake) = echter Seam (codebase-design). KEINE Codegen — Trade-off "heute typsicher" bleibt.

**Betroffene Dateien:** Neu tests/helpers/fakeIpc.ts. Optional minimaler bridge.ts-Touch (siehe D4).

**Test (TDD):** Smoke-Test der zeigt: detectionActions lässt sich mit fakeIpc ohne echtes Electron testen → beweist Seam.

**Größe:** S · **Regressionsrisiko:** SEHR NIEDRIG (nur Test-Infra).

**Akzeptanz:** Smoke-Test grün · fakeIpc deckt genutzte bridge-Methoden ab · npx tsc --noEmit sauber.

**Blockiert von:** nichts · **Blockiert:** #7 (+ ermöglicht #4, #6 Tests) · Plan: .claude/plans/architecture-deepening.md
**Designfrage D4:** fakeIpc nur als Helper oder bridge.ts api() injizierbar machen? (mit User klären)