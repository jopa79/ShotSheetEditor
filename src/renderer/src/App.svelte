<script lang="ts">
  // ShotSheetEditor V2.0 — Root-Komponente
  // Layout: Toolbar | Main (Grid + Video) | Sidebar | Statusbar

  import Toolbar from './components/layout/Toolbar.svelte'
  import Statusbar from './components/layout/Statusbar.svelte'
  import Toast from './components/shared/Toast.svelte'
  import ContextMenu from './components/shared/ContextMenu.svelte'
  import ProgressOverlay from './components/shared/ProgressOverlay.svelte'
  import ShotGrid from './components/grid/ShotGrid.svelte'
  import VideoPlayer from './components/video/VideoPlayer.svelte'
  import InfoPanel from './components/info/InfoPanel.svelte'
  import SelectionBar from './components/grid/SelectionBar.svelte'

  import {
    setupIpcListeners,
    registerExtractProgressHandler,
  } from './lib/ipc/listeners'
  import * as ipc from './lib/ipc/bridge'
  import {
    getIsTranscoding,
    getTranscodeProgress,
    setIsTranscoding,
    setTranscodeProgress,
    getScenes,
    setScenes,
    getIsDirty,
  } from './lib/stores'
  import { resetAllStores } from './lib/stores'
  import * as undoRedo from './lib/actions/undoRedo'
  import * as videoActions from './lib/actions/videoActions'
  import * as detectionActions from './lib/actions/detectionActions'
  import * as selectionActions from './lib/actions/selectionActions'
  import * as projectActions from './lib/actions/projectActions'
  import * as exportActions from './lib/actions/exportActions'
  import * as themeActions from './lib/actions/themeActions'
  import { showToast } from './lib/actions/toastManager'
  import { setupShortcuts } from './lib/actions/shortcuts'
  import { SUPPORTED_FORMATS } from '../../shared/constants'
  import type { ContextMenuItem } from './components/shared/ContextMenu.svelte'

  // --- App-State ---
  let version = $state('...')
  let ffmpegAvailable = $state(false)
  let contextMenuRef: ContextMenu | undefined = $state()

  // --- Globaler ContextMenu-Zugang ---
  // Wird von ShotGrid etc. aufgerufen
  export function showContextMenu(items: ContextMenuItem[], x: number, y: number) {
    contextMenuRef?.show(items, x, y)
  }

  // --- Init: Version + FFmpeg ---
  $effect(() => {
    ipc.getVersion()
      .then((result) => {
        if (result?.success) {
          version = result.version ?? '2.0.0-alpha'
          ffmpegAvailable = result.ffmpeg?.available ?? false
          if (!ffmpegAvailable) {
            showToast('FFmpeg not found. Some features may not work.', 'warning')
          }
        } else {
          version = '2.0.0-alpha'
        }
      })
      .catch(() => {
        version = '2.0.0-alpha'
      })
  })

  // --- Theme laden ---
  $effect(() => {
    ipc.getTheme()
      .then((result) => {
        const theme = result?.theme ?? 'dark'
        document.documentElement.classList.toggle('light-theme', theme === 'light')
      })
      .catch(() => {
        document.documentElement.classList.remove('light-theme')
      })
  })

  // --- IPC Listeners ---
  $effect(() => {
    return setupIpcListeners()
  })

  // --- Progressive Detection-Thumbnails ---
  // Die progressive Szenen-Logik (registerDetectNewScenesHandler + thumbnailQueue)
  // liegt jetzt im DetectionOrchestrator (detectionOrchestrator.ts).
  // Hier nur noch das progressive Mergen einzelner Thumbnails in den Store.
  $effect(() => {
    registerExtractProgressHandler((data) => {
      if (!data.frameResult) return
      const { index, path } = data.frameResult
      const scenes = getScenes()
      const updated = scenes.map((s) =>
        s.index === index ? { ...s, thumbPath: path } : s
      )
      setScenes(updated)
    })
  })

  // --- Menu Actions ---
  $effect(() => {
    const cleanup = ipc.onMenuAction((action) => {
      switch (action) {
        case 'file:openVideo':
          videoActions.openVideo()
          break
        case 'file:new':
          if (getIsDirty()) {
            const confirmed = confirm('Du hast ungespeicherte Änderungen. Neues Projekt ohne Speichern erstellen?')
            if (!confirmed) break
          }
          videoActions.callPauseAndReset()
          resetAllStores()
          undoRedo.clear()
          showToast('New project created', 'info')
          break
        case 'file:open':
          projectActions.openProject()
          break
        case 'file:save':
          projectActions.saveProject()
          break
        case 'file:saveAs':
          projectActions.saveProjectAs()
          break
        case 'edit:undo':
          if (undoRedo.canUndo()) undoRedo.undo()
          break
        case 'edit:redo':
          if (undoRedo.canRedo()) undoRedo.redo()
          break
        case 'edit:selectAll':
          selectionActions.selectAll()
          break
        case 'edit:deselect':
          selectionActions.deselectAll()
          break
        case 'view:toggleTheme':
          themeActions.toggleTheme()
          break
        case 'view:zoomIn':
        case 'view:zoomOut':
        case 'view:zoomReset':
          // Wird von ShotGrid intern gehandelt via gridSize Store
          break
        case 'export:sequence':
          exportActions.exportSequence()
          break
        case 'export:zip':
          exportActions.exportZip()
          break
        default:
          console.warn('App: Unknown menu action:', action)
      }
    })

    return cleanup
  })

  // --- Keyboard Shortcuts ---
  $effect(() => {
    return setupShortcuts()
  })

  // --- Drag & Drop ---
  $effect(() => {
    function handleDragover(e: DragEvent) {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      document.body.classList.add('drag-over')
    }

    function handleDragleave(e: DragEvent) {
      if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
        document.body.classList.remove('drag-over')
      }
    }

    async function handleDrop(e: DragEvent) {
      e.preventDefault()
      document.body.classList.remove('drag-over')
      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        const filePath = (files[0] as File & { path?: string }).path
        if (filePath) {
          if (!videoActions.isSupportedFormat(filePath)) {
            showToast(
              `Unsupported format. Supported: ${(SUPPORTED_FORMATS as readonly string[]).join(', ')}`,
              'warning'
            )
            return
          }
          videoActions.openVideoFromPath(filePath)
        }
      }
    }

    document.addEventListener('dragover', handleDragover)
    document.addEventListener('dragleave', handleDragleave)
    document.addEventListener('drop', handleDrop)

    return () => {
      document.removeEventListener('dragover', handleDragover)
      document.removeEventListener('dragleave', handleDragleave)
      document.removeEventListener('drop', handleDrop)
    }
  })

  // --- Transcoding Cancel ---
  async function handleCancelTranscoding() {
    if (getIsTranscoding()) {
      await ipc.cancelProxy()
      setIsTranscoding(false)
      setTranscodeProgress(0)
      showToast('Transcoding abgebrochen', 'info')
    }
  }

  // --- Detection Cancel ---
  async function handleCancelDetection() {
    await detectionActions.cancelDetection()
  }
</script>

<div class="app-shell">
  <Toolbar {showContextMenu} />

  <div class="main-content">
    <div class="main-area">
      <VideoPlayer />
      <ShotGrid {showContextMenu} />
      <SelectionBar {showContextMenu} />
      <ProgressOverlay
        visible={getIsTranscoding()}
        title="Transcoding Proxy..."
        progress={getTranscodeProgress()}
        oncancel={handleCancelTranscoding}
      />
    </div>
    <aside class="sidebar">
      <InfoPanel />
    </aside>
  </div>

  <Statusbar {version} {ffmpegAvailable} />
</div>

<!-- Globale Overlays -->
<Toast />
<ContextMenu bind:this={contextMenuRef} />

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--bg-0);
    color: var(--text-0);
    font-family: var(--font-ui);
  }

  .main-content {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .main-area {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sidebar {
    width: 240px;
    min-width: 200px;
    background: var(--bg-1);
    border-left: 1px solid var(--border);
    overflow-y: auto;
  }
</style>
