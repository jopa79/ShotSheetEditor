## Phase A (Quick) — parallelisierbar mit #1, #2. Haupt-Worktree.

**Root Cause:** Toolbar.svelte:94 ruft `await ipc.toggleTheme()` direkt → verletzt "Komponenten rufen nur Actions auf, nie direkt IPC".

**Lösung:** Neu `themeActions.ts` mit `toggleTheme()` (delegiert an ipc.toggleTheme). Toolbar.svelte ruft themeActions.toggleTheme().

**Betroffene Dateien:** Toolbar.svelte, neu themeActions.ts.

**Größe:** XS · **Regressionsrisiko:** SEHR NIEDRIG.

**Akzeptanz:** Theme-Toggle funktioniert in npm run dev · grep zeigt kein ipc. mehr in Toolbar.svelte · npx tsc --noEmit sauber.

**Blockiert von:** nichts · **Parallelisierbar mit:** #1, #2 · Plan: .claude/plans/architecture-deepening.md