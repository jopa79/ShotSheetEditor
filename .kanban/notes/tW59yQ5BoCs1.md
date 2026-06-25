## Phase C (Renderer, sequenziell) — Schritt 1 von 4. Haupt-Worktree.

**KORREKTUR ggü. Explore-Claim:** Tatsächlich **11 commit()-Sites über 2 Dateien** (selectionActions 6, collectionActions 5), NICHT "23 über 6". Andere 4 Dateien importieren undoRedo nur für undo/redo/clear/canUndo — kein commit(). Blast-Radius klein.

**Root Cause:** Invariante "commit VOR setState" nur per Kommentar (Fix #87, Fix #123) — leicht zu brechen.

**Lösung:** undoRedo.ts + `withUndo<T>(fn:()=>T):T` — Snapshot, dann fn. Jede `commit();…mutation…` → `withUndo(()=>{…mutation…})`.

**Betroffene Dateien:** undoRedo.ts, selectionActions.ts (6), collectionActions.ts (5).

**Test (TDD):** undoRedo.test.ts erweitern (existiert): withUndo legt Snapshot an, undo() stellt Pre-fn-State her, fn wirft → Stack-Konsistenz (D2). selectionActions/collectionActions.test.ts: Verhalten unverändert.

**Größe:** S · **Regressionsrisiko:** NIEDRIG-MITTEL · Zuerst in Phase C, weil es die 11 Sites vereinfacht die #7 danach anfasst.

**Akzeptanz:** undoRedo + selectionActions + collectionActions Tests grün · grep 0 nackte undoRedo.commit() in Actions · npx tsc --noEmit sauber.

**Blockiert von:** nichts · **Reihenfolge:** vor #7 · teilt Dateien mit #7 · Plan: .claude/plans/architecture-deepening.md
**Designfrage D2:** fn wirft → Snapshot lassen oder zurückrollen? (mit User klären)