<script lang="ts">
  // Toolbar.svelte — Hauptwerkzeugleiste
  // Open Video, Detect, Threshold, Undo/Redo, Grid Size, Filter, Export, Theme

  import Button from '../shared/Button.svelte'
  import type { ContextMenuItem } from '../shared/ContextMenu.svelte'
  import {
    getThreshold,
    setThreshold,
    getIsDetecting,
    getDetectingSceneCount,
    getGridSize,
    setGridSize,
    getFilterMode,
    setFilterMode,
    setActiveCollectionId,
    getVideoPath,
    getScenes,
  } from '../../lib/stores'
  import * as videoActions from '../../lib/actions/videoActions'
  import * as detectionActions from '../../lib/actions/detectionActions'
  import * as exportActions from '../../lib/actions/exportActions'
  import * as undoRedo from '../../lib/actions/undoRedo'
  import * as ipc from '../../lib/ipc/bridge'
  import type { FilterMode } from '../../lib/stores/uiState.svelte'

  // --- Props ---
  interface Props {
    showContextMenu: (items: ContextMenuItem[], x: number, y: number) => void
  }
  const { showContextMenu }: Props = $props()

  // --- Grid Sizes ---
  const GRID_SIZES = [
    { label: 'S', value: 150 },
    { label: 'M', value: 200 },
    { label: 'L', value: 300 },
    { label: 'XL', value: 400 },
  ] as const

  // --- Threshold ---
  let thresholdDisplay = $state('0.30')

  function handleThresholdInput(e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value) || 0.3
    setThreshold(value)
    thresholdDisplay = value.toFixed(2)
  }

  // Fix #126: Guard verhindert Re-Detect während Detection läuft
  function handleThresholdCommit() {
    if (getIsDetecting()) return
    if (getVideoPath() && getScenes().length > 0) {
      detectionActions.detectScenes()
    }
  }

  // Threshold-Display synchron halten
  $effect(() => {
    thresholdDisplay = getThreshold().toFixed(2)
  })

  // --- Grid Size ---
  function handleGridSize(size: number) {
    setGridSize(size)
  }

  // --- Filter ---
  function handleFilter(mode: FilterMode) {
    if (mode === 'all') {
      setActiveCollectionId(null)
    }
    setFilterMode(mode)
  }

  // --- Export Context-Menu ---
  function handleExportClick(e: MouseEvent) {
    const items: ContextMenuItem[] = [
      {
        label: 'Export Sequence (H.264)',
        action: () => exportActions.exportSequence(),
      },
      {
        label: 'Export Thumbnails (ZIP)',
        action: () => exportActions.exportZip(),
      },
    ]
    showContextMenu(items, e.clientX, e.clientY)
  }

  // --- Theme ---
  async function handleThemeToggle() {
    try {
      await ipc.toggleTheme()
    } catch (err) {
      console.error('Toolbar: toggleTheme failed', err)
    }
  }
</script>

<header class="toolbar">
  <!-- Links: Video + Detection -->
  <div class="toolbar-group">
    <Button onclick={() => videoActions.openVideo()} title="Open Video (Cmd+O)">
      Open Video
    </Button>

    <div class="toolbar-separator"></div>

    <Button
      onclick={() => detectionActions.detectScenes()}
      disabled={getIsDetecting() || !getVideoPath()}
      title="Detect Scenes"
    >
      {#if getIsDetecting()}
        {getDetectingSceneCount() > 0
          ? `Detecting... (${getDetectingSceneCount()})`
          : 'Detecting...'}
      {:else}
        Detect Scenes
      {/if}
    </Button>

    <div class="threshold-control">
      <input
        type="range"
        class="threshold-slider"
        min="0.05"
        max="0.9"
        step="0.01"
        value={getThreshold()}
        oninput={handleThresholdInput}
        onchange={handleThresholdCommit}
      />
      <span class="threshold-value">{thresholdDisplay}</span>
    </div>
  </div>

  <!-- Mitte: Undo/Redo + Grid Size + Filter -->
  <div class="toolbar-group">
    <Button onclick={() => undoRedo.undo()} disabled={!undoRedo.canUndo()} title="Undo (Cmd+Z)">
      Undo
    </Button>
    <Button onclick={() => undoRedo.redo()} disabled={!undoRedo.canRedo()} title="Redo (Cmd+Shift+Z)">
      Redo
    </Button>

    <div class="toolbar-separator"></div>

    <div class="pill-group">
      {#each GRID_SIZES as gs}
        <button
          class="pill"
          class:active={getGridSize() === gs.value}
          onclick={() => handleGridSize(gs.value)}
        >
          {gs.label}
        </button>
      {/each}
    </div>

    <div class="toolbar-separator"></div>

    <div class="pill-group">
      <button
        class="pill"
        class:active={getFilterMode() === 'all'}
        onclick={() => handleFilter('all')}
      >
        All
      </button>
      <button
        class="pill"
        class:active={getFilterMode() === 'favorites'}
        onclick={() => handleFilter('favorites')}
      >
        Favs
      </button>
    </div>
  </div>

  <!-- Rechts: Export + Theme -->
  <div class="toolbar-group">
    <Button onclick={handleExportClick} title="Export (Sequence / ZIP)">
      Export
    </Button>
    <Button onclick={handleThemeToggle} title="Toggle Theme" variant="ghost">
      Theme
    </Button>
  </div>
</header>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 40px;
    padding: 0 var(--sp-lg);
    background: var(--bg-1);
    border-bottom: 1px solid var(--border);
    -webkit-app-region: drag;
    gap: var(--sp-md);
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    -webkit-app-region: no-drag;
  }

  .toolbar-separator {
    width: 1px;
    height: 16px;
    background: var(--border);
    margin: 0 var(--sp-sm);
  }

  .threshold-control {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
  }

  .threshold-slider {
    width: 80px;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--bg-4);
    border-radius: 2px;
    outline: none;
  }

  .threshold-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
  }

  .threshold-value {
    font-family: var(--font-mono);
    font-size: var(--fs-secondary);
    color: var(--text-2);
    min-width: 28px;
    text-align: right;
  }

  .pill-group {
    display: flex;
    gap: 1px;
    background: var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .pill {
    padding: var(--sp-xs) var(--sp-md);
    font-size: var(--fs-secondary);
    color: var(--text-2);
    background: var(--bg-2);
    min-width: 28px;
    text-align: center;
  }

  .pill:hover {
    color: var(--text-0);
    background: var(--bg-3);
  }

  .pill.active {
    color: var(--accent);
    background: var(--accent-glow);
  }
</style>
