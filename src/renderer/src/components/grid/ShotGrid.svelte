<script lang="ts">
  // ShotGrid.svelte — Grid-Container mit CSS Grid
  // Ersetzt V1 shotGrid.js (447 LOC)

  import ShotCard from './ShotCard.svelte'
  import EmptyState from './EmptyState.svelte'
  import type { ContextMenuItem } from '../shared/ContextMenu.svelte'
  import {
    getGridSize,
    getFavoriteIndices,
    getSelectedIndices,
    getDeletedIndices,
    getCurrentShotIdx,
    getVideoMeta,
    getVisibleScenes,
  } from '../../lib/stores'

  interface Props {
    showContextMenu: (items: ContextMenuItem[], x: number, y: number) => void
  }

  let { showContextMenu }: Props = $props()

  // Sets für O(1) Lookups
  let favoriteSet = $derived(new Set(getFavoriteIndices()))
  let selectedSet = $derived(new Set(getSelectedIndices()))
  let deletedSet = $derived(new Set(getDeletedIndices()))
  let currentIdx = $derived(getCurrentShotIdx())
  let visibleScenes = $derived(getVisibleScenes())
  let gridSize = $derived(getGridSize())

  // Grid-Spalten-Template
  let gridTemplateColumns = $derived(
    `repeat(auto-fill, minmax(${gridSize}px, 1fr))`
  )

  // Zeilenhöhe basierend auf Video-Seitenverhältnis
  let gridAutoRows = $derived.by(() => {
    const meta = getVideoMeta()
    const w = meta?.data?.width ?? 16
    const h = meta?.data?.height ?? 9
    const thumbHeight = Math.round(gridSize * (h / w))
    return `${thumbHeight + 32}px` // 32px = Footer-Höhe
  })
</script>

{#if visibleScenes.length === 0}
  <EmptyState />
{:else}
  <div
    class="shot-grid"
    style="grid-template-columns: {gridTemplateColumns}; grid-auto-rows: {gridAutoRows};"
  >
    {#each visibleScenes as scene (scene.originalIdx)}
      <ShotCard
        {scene}
        isFavorite={favoriteSet.has(scene.originalIdx)}
        isSelected={selectedSet.has(scene.originalIdx)}
        isDeleted={deletedSet.has(scene.originalIdx)}
        isCurrent={currentIdx === scene.originalIdx}
        {showContextMenu}
      />
    {/each}
  </div>
{/if}

<style>
  .shot-grid {
    display: grid;
    gap: var(--sp-md);
    padding: var(--sp-md);
    overflow-y: auto;
    flex: 1;
    align-content: start;
  }
</style>
