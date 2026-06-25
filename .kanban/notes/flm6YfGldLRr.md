## Phase A (Critical) — parallelisierbar mit #2, #TB. Eigener Worktree.

**Root Cause:** Path-Validierung 14x dupliziert in 3 Varianten: (a) home+sep only (projectManager 2x, ipcHandlers PROJECT_OPEN/FRAME-thumb), (b) home+sep||tmp+sep (proxy/export/extract), (c) **home||tmp OHNE sep = protocolHandler.ts:44 = echter Security-Bug**.

**Lösung:** `src/main/pathSecurity.ts` — `validateForRead(p): string` (realpath + allow home∪tmp), `validateForWrite(dir): string`. projectManager braucht home-only-Variante (allowTmp=false). Wirft typisierten PathSecurityError.

**Betroffene Dateien:** ipcHandlers.ts (6x), proxyGenerator.ts (1x), exportManager.ts (3x), projectManager.ts (3x, home-only!), protocolHandler.ts (1x +path.sep-Fix). Neu: pathSecurity.ts.

**Test (TDD):** Unit-Tests gegen pathSecurity.ts: erlaubt home/tmp; lehnt außerhalb ab; **lehnt Präfix-Angriff /Users/joachim-evil ab**; lehnt nicht-existent ab; Symlink-Escape via realpath. Reines Node, kein Electron-Mock.

**Größe:** M · **Regressionsrisiko:** MITTEL (projectManager home-only nicht versehentlich tmp erlauben).

**Akzeptanz:** npm test grün (inkl. Präfix-Angriff-Test) · npx tsc --noEmit sauber · grep zeigt 0 inline startsWith(homeDir außerhalb pathSecurity.ts · App startet.

**Blockiert von:** nichts · **Parallelisierbar mit:** #2, #TB · Plan: .claude/plans/architecture-deepening.md
**Designfrage D3:** Soll #2 den Path-Check in proxyGenerator durch diese Funktionen ersetzen? (mit User klären)
**Related:** Kanban TgLC6ygdkscC (Custom Protocol, in Review).