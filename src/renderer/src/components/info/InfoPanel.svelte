<script lang="ts">
  // InfoPanel.svelte — Sidebar mit Scene-Details + Collections
  // Ersetzt V1 infoPanel.js (277 LOC) + collectionManager.js UI-Teile

  import Button from '../shared/Button.svelte'
  import { formatTimecode } from '../../lib/utils/timecode'
  import {
    getCurrentShotIdx,
    getCurrentScene,
    getFavoriteIndices,
    getDeletedIndices,
    getCollections,
    getActiveCollectionId,
  } from '../../lib/stores'
  import * as collectionActions from '../../lib/actions/collectionActions'

  // --- Abgeleitete Werte ---
  let currentIdx = $derived(getCurrentShotIdx())
  let scene = $derived(getCurrentScene())
  let collections = $derived(getCollections())
  let activeId = $derived(getActiveCollectionId())

  let isFav = $derived(getFavoriteIndices().includes(currentIdx))
  let isDeleted = $derived(getDeletedIndices().includes(currentIdx))

  let statusText = $derived.by(() => {
    const parts: string[] = []
    if (isFav) parts.push('Favorite')
    if (isDeleted) parts.push('Deleted')
    if (parts.length === 0) parts.push('Active')
    return parts.join(', ')
  })

  let memberOfCollections = $derived(
    collections.filter((c) => c.indices.includes(currentIdx))
  )

  // --- Collection-Aktionen ---
  function handleCreateCollection() {
    const name = prompt('Collection name:')
    if (name?.trim()) {
      collectionActions.createCollection(name)
    }
  }

  function handleToggleCollection(colId: string) {
    if (activeId === colId) {
      collectionActions.clearActiveCollection()
    } else {
      collectionActions.setActiveCollection(colId)
    }
  }

  function handleRenameCollection(colId: string, currentName: string) {
    const newName = prompt('Rename collection:', currentName)
    if (newName?.trim()) {
      collectionActions.renameCollection(colId, newName)
    }
  }

  function handleDeleteCollection(colId: string, name: string) {
    if (confirm(`Delete collection "${name}"?`)) {
      collectionActions.deleteCollection(colId)
    }
  }
</script>

<div class="info-panel">
  <!-- Oberer Bereich: Shot-Details -->
  <div class="info-section">
    {#if scene && currentIdx >= 0}
      <div class="info-field">
        <div class="info-label">Shot</div>
        <div class="info-value">#{currentIdx + 1}</div>
      </div>
      <div class="info-field">
        <div class="info-label">Timecode</div>
        <div class="info-value">{formatTimecode(scene.startTime)}</div>
      </div>
      <div class="info-field">
        <div class="info-label">Status</div>
        <div class="info-value">{statusText}</div>
      </div>
      {#if memberOfCollections.length > 0}
        <div class="info-field">
          <div class="info-label">Collections</div>
          <div class="info-value">{memberOfCollections.map((c) => c.name).join(', ')}</div>
        </div>
      {/if}
    {:else}
      <div class="info-placeholder">Select a shot to view details</div>
    {/if}
  </div>

  <!-- Trennlinie -->
  <div class="divider"></div>

  <!-- Unterer Bereich: Collections -->
  <div class="info-section">
    <div class="collection-header">
      <div class="info-label">Collections</div>
      <Button size="sm" variant="ghost" onclick={handleCreateCollection}>+ New</Button>
    </div>

    {#if collections.length === 0}
      <div class="collection-empty">No collections yet</div>
    {:else}
      <div class="collection-list">
        {#each collections as col (col.id)}
          <div
            class="collection-item"
            class:active={col.id === activeId}
          >
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="collection-item-info"
              onclick={() => handleToggleCollection(col.id)}
            >
              <span class="collection-item-name">{col.name}</span>
              <span class="collection-item-count">{col.indices.length}</span>
            </div>
            <div class="collection-item-actions">
              <button
                class="collection-action-btn"
                onclick={(e) => { e.stopPropagation(); handleRenameCollection(col.id, col.name) }}
              >Rename</button>
              <button
                class="collection-action-btn danger"
                onclick={(e) => { e.stopPropagation(); handleDeleteCollection(col.id, col.name) }}
              >Delete</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .info-panel {
    padding: var(--sp-md);
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
  }

  .info-section {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }

  .info-field {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .info-label {
    font-size: var(--fs-secondary);
    color: var(--text-2);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .info-value {
    font-size: var(--fs-content);
    color: var(--text-1);
    font-family: var(--font-mono);
  }

  .info-placeholder {
    font-size: var(--fs-content);
    color: var(--text-2);
    font-style: italic;
    padding: var(--sp-sm) 0;
  }

  .divider {
    height: 1px;
    background: var(--border);
  }

  .collection-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .collection-empty {
    font-size: var(--fs-secondary);
    color: var(--text-2);
    font-style: italic;
    padding: var(--sp-xs) 0;
  }

  .collection-list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .collection-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sp-xs) var(--sp-sm);
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    transition: background var(--transition-fast);
  }

  .collection-item:hover {
    background: var(--bg-2);
  }

  .collection-item.active {
    background: var(--accent-glow);
    border-color: var(--accent-dim);
  }

  .collection-item-info {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    cursor: pointer;
    flex: 1;
    min-width: 0;
  }

  .collection-item-name {
    font-size: var(--fs-content);
    color: var(--text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .collection-item-count {
    font-size: var(--fs-secondary);
    color: var(--text-2);
    font-family: var(--font-mono);
    flex-shrink: 0;
  }

  .collection-item-actions {
    display: flex;
    gap: var(--sp-xs);
    opacity: 0;
    transition: opacity var(--transition-fast);
  }

  .collection-item:hover .collection-item-actions {
    opacity: 1;
  }

  .collection-action-btn {
    font-size: var(--fs-secondary);
    color: var(--text-2);
    cursor: pointer;
    padding: 2px var(--sp-xs);
    border-radius: var(--radius-sm);
    transition: color var(--transition-fast);
  }

  .collection-action-btn:hover {
    color: var(--text-0);
  }

  .collection-action-btn.danger:hover {
    color: var(--danger);
  }
</style>
