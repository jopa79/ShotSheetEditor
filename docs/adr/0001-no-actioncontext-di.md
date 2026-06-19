# ADR-0001 — Kein ActionContext-Dependency-Injection für Actions

- **Status:** Akzeptiert
- **Datum:** 2026-06-19
- **Kontext:** Architektur-Deepening-Initiative (Welle 1)

## Entscheidung

Die `lib/actions/*.ts`-Module bekommen **kein** injiziertes `ActionContext`-Objekt
(`{ stores, ipc, toast, undo }`). Actions greifen weiterhin direkt per Import auf
Stores und die IPC-Bridge zu.

## Grund

Das beobachtete Problem — 4 von 10 action-Modulen (`videoActions`,
`detectionActions`, `exportActions`, `thumbnailQueue`) sind ungetestet — hat als
**kausale Wurzel kein fehlendes DI, sondern das Fehlen eines `window.electronAPI`-Mocks**
in `tests/`. Ein fake-IPC-Test-seam (Kandidat #5 dieser Initiative) macht die
Module testbar, ohne jede Action-Signatur zu ändern.

Ein `ActionContext` würde dagegen **jede** action-Datei anfassen (großer
Blast-Radius, hohes Merge-Konflikt-Risiko mit den parallelen Deepenings #3/#4/#6)
für geschätzt ~20 % zusätzlichen Testbarkeits-Gewinn über #5 hinaus. Das ist
über-abstrahiert: ein hypothetischer seam (ein einziger Adapter — der Test-Fake),
kein realer (zwei Adapter, die tatsächlich variieren).

## Verworfene Alternativen

- **`ActionContext` als Funktions-Argument** — zwingt jeden call site (Komponenten +
  Tests) den Context durchzureichen; verwässert die kleinen Action-interfaces.
- **`setContext()`/Svelte-Context** — bindet Actions an den Component-Lifecycle,
  obwohl sie heute lifecycle-frei testbar sein sollen.

## Konsequenz

Testbarkeit der Actions wird über den fake-IPC-Test-seam (#5) hergestellt. Sollte
sich #5 später als unzureichend erweisen (z. B. wenn Actions echte
Store-Verzweigungslogik bekommen, die nur mit Store-Doubles prüfbar ist), wird
diese Entscheidung neu bewertet — bis dahin **nicht erneut als
Architektur-Kandidat vorschlagen**.
