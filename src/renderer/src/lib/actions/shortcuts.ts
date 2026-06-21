// shortcuts.ts — Keyboard-Shortcuts
// Ersetzt V1 shortcuts.js (188 LOC)
// Guards: nicht in Input/Textarea, nicht bei offenem Modal

import * as selectionActions from './selectionActions'
import * as undoRedo from './undoRedo'
import * as videoActions from './videoActions'
import {
  getSelectedIndices,
  getFavoriteIndices,
  getFilterMode,
  setFilterMode,
  setGridSize,
  setActiveCollectionId,
  getIsDetecting,
} from '../stores'

// --- VideoPlayer-Callbacks ---
// VideoPlayer.svelte registriert sich hier für Play/Pause und Navigation

type VoidFn = () => void

let _togglePlayPauseFn: VoidFn | null = null
let _prevShotFn: VoidFn | null = null
let _nextShotFn: VoidFn | null = null

/** VideoPlayer registriert togglePlayPause (null = deregistrieren) */
export function registerTogglePlayPause(fn: VoidFn | null): void {
  _togglePlayPauseFn = fn
}

/** VideoPlayer registriert prevShot (null = deregistrieren) */
export function registerPrevShot(fn: VoidFn | null): void {
  _prevShotFn = fn
}

/** VideoPlayer registriert nextShot (null = deregistrieren) */
export function registerNextShot(fn: VoidFn | null): void {
  _nextShotFn = fn
}

/** Plattform-Check: Cmd (macOS) oder Ctrl (Windows/Linux) */
function isCmdCtrl(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey
}

/** Guard: Modal offen? */
function isModalOpen(): boolean {
  return document.querySelector('.modal-backdrop') !== null
}

/** Keydown-Handler */
function handleKeydown(e: KeyboardEvent): void {
  const target = e.target as HTMLElement

  // Guard: In Input/Textarea nicht abfangen (außer Cmd/Ctrl + Escape)
  if (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.contentEditable === 'true'
  ) {
    if (!isCmdCtrl(e) && e.key !== 'Escape') return
  }

  switch (true) {
    // Cmd/Ctrl+O: Video öffnen
    case isCmdCtrl(e) && e.key === 'o':
      e.preventDefault()
      videoActions.openVideo()
      break

    // Cmd/Ctrl+Z: Undo
    case isCmdCtrl(e) && e.key === 'z' && !e.shiftKey:
      e.preventDefault()
      if (undoRedo.canUndo()) undoRedo.undo()
      break

    // Cmd/Ctrl+Shift+Z: Redo
    case isCmdCtrl(e) && e.key === 'z' && e.shiftKey:
      e.preventDefault()
      if (undoRedo.canRedo()) undoRedo.redo()
      break

    // Cmd/Ctrl+A: Alles auswählen
    case isCmdCtrl(e) && e.key === 'a':
      e.preventDefault()
      selectionActions.selectAll()
      break

    // Escape: Auswahl aufheben
    case e.key === 'Escape':
      e.preventDefault()
      selectionActions.deselectAll()
      break

    // Delete/Backspace: Ausgewählte löschen — nicht bei offenem Modal (#124)
    case e.key === 'Delete' || e.key === 'Backspace':
      e.preventDefault()
      if (isModalOpen()) break
      selectionActions.deleteSelected()
      break

    // F: Favoriten togglen
    case e.key === 'f' || e.key === 'F': {
      e.preventDefault()
      const selected = getSelectedIndices()
      const favorites = getFavoriteIndices()
      if (selected.length > 0) {
        const allAreFav = selected.every((idx) => favorites.includes(idx))
        if (allAreFav) {
          selectionActions.unfavSelected()
        } else {
          selectionActions.favSelected()
        }
      }
      break
    }

    // ArrowLeft: Vorheriger Shot
    case e.key === 'ArrowLeft':
      e.preventDefault()
      _prevShotFn?.()
      break

    // ArrowRight: Nächster Shot
    case e.key === 'ArrowRight':
      e.preventDefault()
      _nextShotFn?.()
      break

    // Space: Play/Pause — nicht bei offenem Modal (#136), nicht bei Detection
    case e.key === ' ':
      e.preventDefault()
      if (isModalOpen() || getIsDetecting()) break
      _togglePlayPauseFn?.()
      break

    // 1-4: Grid-Größe
    case e.key === '1':
      e.preventDefault()
      setGridSize(150)
      break
    case e.key === '2':
      e.preventDefault()
      setGridSize(200)
      break
    case e.key === '3':
      e.preventDefault()
      setGridSize(300)
      break
    case e.key === '4':
      e.preventDefault()
      setGridSize(400)
      break

    // I: Auswahl invertieren
    case e.key === 'i' || e.key === 'I':
      e.preventDefault()
      selectionActions.invertSelection()
      break

    // V: Filter-Toggle — bei Collection zurück zu 'all' + activeCollectionId löschen (#137)
    case e.key === 'v' || e.key === 'V': {
      e.preventDefault()
      const current = getFilterMode()
      if (current === 'collection') {
        setFilterMode('all')
        setActiveCollectionId(null)
      } else {
        setFilterMode(current === 'all' ? 'favorites' : 'all')
      }
      break
    }

    default:
      break
  }
}

/**
 * Shortcuts initialisieren — gibt Cleanup-Funktion zurück.
 * Wird in App.svelte per $effect aufgerufen.
 */
export function setupShortcuts(): () => void {
  document.addEventListener('keydown', handleKeydown)
  return () => {
    document.removeEventListener('keydown', handleKeydown)
  }
}
