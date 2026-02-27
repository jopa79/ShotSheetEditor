# Issue Duplicate Analysis

**Date:** 2026-02-27
**Total open issues:** 54
**Identified duplicates:** 19 (to close)
**Remaining after cleanup:** 35

---

## Duplicate Groups

### Group 1: eval() on ffprobe output (Code Injection)
| Issue | Title | Action |
|-------|-------|--------|
| **#16** | CRITICAL/SECURITY: eval() auf ffprobe-Output — Remote Code Execution | **KEEP** (more comprehensive edge-case analysis) |
| #1 | CRITICAL/SECURITY: eval() auf ffprobe-Output ermöglicht Code Injection | CLOSE as duplicate of #16 |

### Group 2: Shell/Command Injection via execSync in ffmpegBridge
| Issue | Title | Action |
|-------|-------|--------|
| **#18** | CRITICAL/SECURITY: Command Injection via execSync in ffmpegBridge | **KEEP** (concrete attack example) |
| #2 | CRITICAL/SECURITY: Shell Injection via execSync in ffmpegBridge | CLOSE as duplicate of #18 |

### Group 3: scene.startTime does not exist
| Issue | Title | Action |
|-------|-------|--------|
| **#3** | CRITICAL: scene.startTime existiert nicht — Timecodes, Seeking, Thumbnails broken | **KEEP** (most comprehensive location listing) |
| #19 | CRITICAL/Bug: scene.startTime existiert nicht — gesamte Shot-Logik broken | CLOSE as duplicate of #3 |

### Group 4: getThumb IPC signature mismatch
| Issue | Title | Action |
|-------|-------|--------|
| **#4** | CRITICAL: getThumb IPC-Signatur falsch — Thumbnails laden nie | **KEEP** (explains complete missing workflow) |
| #20 | CRITICAL/Bug: IPC.getThumb mit falscher Signatur aufgerufen — liest ganzes Video als Base64 | CLOSE as duplicate of #4 |

### Group 5: gridSize String instead of Number
| Issue | Title | Action |
|-------|-------|--------|
| **#5** | CRITICAL: gridSize bekommt String statt Zahl — Grid und Virtual Scroll broken | **KEEP** (SIZE_MAP solution + full impact analysis) |
| #21 | CRITICAL/Bug: Grid Size String statt Number bricht Virtual Scrolling | CLOSE as duplicate of #5 |
| #44 | HIGH/Bug: gridSize als String statt Number — Virtual-Scroll-Berechnung kaputt | CLOSE as duplicate of #5 |

### Group 6: Non-atomic save in projectManager.js
| Issue | Title | Action |
|-------|-------|--------|
| **#6** | CRITICAL: Nicht-atomares Save — Datenverlust-Fenster in projectManager | **KEEP** (oldest issue, clear unlink/rename description) |
| #49 | HIGH: saveProject nicht atomar — Datenverlust bei Crash möglich | CLOSE as duplicate of #6 |

> **Note:** #24 (saveProject stub in toolbar.js) is NOT a duplicate — it describes a different problem (unimplemented save function vs. atomicity bug in projectManager.js).

### Group 7: Path Traversal in getThumb
| Issue | Title | Action |
|-------|-------|--------|
| **#17** | CRITICAL/SECURITY: Path Traversal in FRAME_GET_THUMB — beliebige Dateien lesbar | **KEEP** (more detailed with code line references) |
| #7 | HIGH/SECURITY: Path Traversal in frame:getThumb — beliebige Dateien lesbar | CLOSE as duplicate of #17 |

### Group 8: XSS via innerHTML / missing CSP
| Issue | Title | Action |
|-------|-------|--------|
| **#13** | MEDIUM/SECURITY: Fehlende CSP, XSS via innerHTML, Input-Validierung | **KEEP** (broadest coverage: CSP + XSS + IPC validation + windowState) |
| #27 | HIGH/Security: Kein CSP + XSS via innerHTML in showModal | CLOSE as duplicate of #13 |
| #51 | MEDIUM/Security: innerHTML in showModal — XSS-Risiko | CLOSE as duplicate of #13 |

### Group 9: Race Condition in Scene Detection
| Issue | Title | Action |
|-------|-------|--------|
| **#43** | HIGH/Bug: Race Condition bei parallelen detectScenes-Aufrufen | **KEEP** (broader context: toolbar.js + proxyGenerator pattern) |
| #25 | HIGH/Bug: Race Condition in Scene Detection — Orphaned FFmpeg Prozesse | CLOSE as duplicate of #43 |

### Group 10: Promise Anti-Pattern in IPC Handlers
| Issue | Title | Action |
|-------|-------|--------|
| **#26** | HIGH/Bug: Promise Anti-Pattern in IPC Handlers — Fehler werden verschluckt | **KEEP** (better error propagation explanation) |
| #45 | HIGH/Bug: Double-Promise-Wrapping in ipcHandlers verschluckt Fehler | CLOSE as duplicate of #26 |

---

## Remaining Unique Issues (35 total)

### CRITICAL
| # | Title |
|---|-------|
| #3 | scene.startTime existiert nicht — Timecodes, Seeking, Thumbnails broken |
| #4 | getThumb IPC-Signatur falsch — Thumbnails laden nie |
| #5 | gridSize bekommt String statt Zahl — Grid und Virtual Scroll broken |
| #6 | Nicht-atomares Save — Datenverlust-Fenster in projectManager |
| #16 | eval() auf ffprobe-Output — Remote Code Execution |
| #17 | Path Traversal in FRAME_GET_THUMB — beliebige Dateien lesbar |
| #18 | Command Injection via execSync in ffmpegBridge |

### HIGH
| # | Title |
|---|-------|
| #8 | sceneDetector — quadratisches Parsing und Duplikate in scenes |
| #9 | Video wird doppelt geladen + UndoRedo Snapshot-Timing falsch |
| #10 | Toast Container ID-Mismatch — Toasts ohne CSS-Styling |
| #11 | Memory Leaks — fehlende Listener-Cleanups in mehreren Modulen |
| #12 | Drag & Drop akzeptiert Nicht-Video-Dateien + fehlender meta.success-Check |
| #22 | Play Button ID Mismatch — #playButton vs #btnPlayPause |
| #23 | Selection Bar Buttons nicht gebunden — data-action vs id Mismatch |
| #24 | saveProject täuscht Erfolg vor — Datenverlust-Risiko |
| #26 | Promise Anti-Pattern in IPC Handlers — Fehler werden verschluckt |
| #28 | FFmpeg Filter/Argument Injection via threshold und thumbSize |
| #29 | Kein Navigation/Popup Handler in Electron |
| #43 | Race Condition bei parallelen detectScenes-Aufrufen |
| #46 | IPC-Input-Validierung fehlt — threshold, thumbSize, Pfade ungeprüft |
| #47 | const in switch-case ohne Block-Scope in shortcuts.js |
| #48 | formatTimecode 4x dupliziert mit inkompatiblen Implementierungen |
| #50 | readFileSync blockiert Main-Thread in FRAME_GET_THUMB |

### MEDIUM
| # | Title |
|---|-------|
| #13 | Fehlende CSP, XSS via innerHTML, Input-Validierung |
| #14 | Race Conditions in Quit-Flow und Frame-Extraction |
| #15 | Fehlende .gitignore, README, CHANGELOG und .env.example |
| #52 | getVisibleScenes O(n²) + Virtual Scrolling mit komplettem DOM-Rebuild |
| #53 | frameExtractor Progress bleibt unter 100% bei fehlgeschlagenen Frames |

### LOW
| # | Title |
|---|-------|
| #54 | Debug-Logs entfernen + toter Code aufräumen |
