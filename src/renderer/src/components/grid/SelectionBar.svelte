<script lang="ts">
  // SelectionBar.svelte — Aktionsleiste bei aktiver Selektion

  import type { ContextMenuItem } from '../shared/ContextMenu.svelte'
  import Button from '../shared/Button.svelte'
  import * as selectionActions from '../../lib/actions/selectionActions'
  import * as collectionActions from '../../lib/actions/collectionActions'
  import { showToast } from '../../lib/actions/toastManager'
  import {
    getSelectedIndices,
    getFavoriteIndices,
    getCollections,
  } from '../../lib/stores'

  interface Props {
    showContextMenu: (items: ContextMenuItem[], x: number, y: number) => void
  }

  let { showContextMenu }: Props = $props()

  let selectedCount = $derived(getSelectedIndices().length)
  let allAreFav = $derived.by(() => {
    const selected = getSelectedIndices()
    const favorites = getFavoriteIndices()
    return selected.length > 0 && selected.every((idx) => favorites.includes(idx))
  })

  function handleAddToCollection(e: MouseEvent) {
    const selected = getSelectedIndices()
    if (selected.length === 0) return

    const collections = getCollections()
    const items: ContextMenuItem[] = []

    for (const col of collections) {
      items.push({
        label: `${col.name} (${col.indices.length})`,
        action: () => {
          collectionActions.addToCollection(col.id, selected)
          showToast(`${selected.length} shots added to "${col.name}"`, 'success')
        },
      })
    }

    if (collections.length > 0) {
      items.push({ separator: true })
    }

    items.push({
      label: 'New Collection from Selection...',
      action: () => {
        const name = prompt('Collection name:')
        if (name?.trim()) {
          collectionActions.createCollection(name, selected)
          showToast(`Collection "${name.trim()}" created with ${selected.length} shots`, 'success')
        }
      },
    })

    const rect = (e.target as HTMLElement).getBoundingClientRect()
    showContextMenu(items, rect.left, rect.top - 4)
  }
</script>

{#if selectedCount > 0}
  <div class="selection-bar">
    <span class="selection-count">{selectedCount} selected</span>
    <div class="selection-actions">
      {#if allAreFav}
        <Button size="sm" onclick={() => selectionActions.unfavSelected()}>Unfav</Button>
      {:else}
        <Button size="sm" onclick={() => selectionActions.favSelected()}>Fav</Button>
      {/if}
      <Button size="sm" variant="danger" onclick={() => selectionActions.deleteSelected()}>Delete</Button>
      <Button size="sm" onclick={handleAddToCollection}>Collection</Button>
      <Button size="sm" variant="ghost" onclick={() => selectionActions.deselectAll()}>Clear</Button>
    </div>
  </div>
{/if}

<style>
  .selection-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sp-sm) var(--sp-lg);
    background: var(--accent-glow);
    border-top: 1px solid var(--accent-dim);
    -webkit-app-region: no-drag;
  }

  .selection-count {
    font-size: var(--fs-content);
    font-weight: 600;
    color: var(--accent);
  }

  .selection-actions {
    display: flex;
    gap: var(--sp-sm);
  }
</style>
