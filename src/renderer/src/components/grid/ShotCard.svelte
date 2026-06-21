<script lang="ts">
  // ShotCard.svelte — Einzelne Shot-Karte im Grid

  import type { ContextMenuItem } from '../shared/ContextMenu.svelte'
  import type { Scene } from '../../../../shared/models'
  import { formatTimecode } from '../../lib/utils/timecode'
  import { toLocalMediaUrl } from '../../lib/utils/fileUrl'
  import * as selectionActions from '../../lib/actions/selectionActions'
  import * as collectionActions from '../../lib/actions/collectionActions'
  import { showToast } from '../../lib/actions/toastManager'
  import {
    getCurrentShotIdx,
    setCurrentShotIdx,
    getCollections,
  } from '../../lib/stores'

  interface Props {
    scene: Scene & { originalIdx: number }
    isFavorite: boolean
    isSelected: boolean
    isDeleted: boolean
    isCurrent: boolean
    showContextMenu: (items: ContextMenuItem[], x: number, y: number) => void
  }

  let { scene, isFavorite, isSelected, isDeleted, isCurrent, showContextMenu }: Props = $props()

  // Thumbnail-URL berechnen
  let thumbSrc = $derived(
    scene.thumbPath
      ? toLocalMediaUrl(scene.thumbPath)
      : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="112"%3E%3Crect fill="%23333" width="200" height="112"/%3E%3C/svg%3E'
  )

  function handleClick(e: MouseEvent) {
    if (e.shiftKey) {
      selectionActions.selectRange(getCurrentShotIdx(), scene.originalIdx)
    } else if (e.ctrlKey || e.metaKey) {
      selectionActions.selectShot(scene.originalIdx)
    } else {
      setCurrentShotIdx(scene.originalIdx)
    }
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault()
    const idx = scene.originalIdx

    const items: ContextMenuItem[] = [
      {
        label: isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
        action: () => selectionActions.toggleFavorite(idx),
      },
      { separator: true },
      {
        label: isSelected ? 'Deselect' : 'Select',
        action: () => selectionActions.selectShot(idx),
      },
      {
        label: 'Select Range',
        action: () => selectionActions.selectRange(getCurrentShotIdx(), idx),
      },
      { separator: true },
      {
        label: isDeleted ? 'Restore Shot' : 'Delete Shot',
        action: () => {
          if (isDeleted) {
            selectionActions.restoreSingle(idx)
          } else {
            selectionActions.deleteSingle(idx)
          }
        },
      },
      { separator: true },
      {
        label: 'Add to Collection...',
        action: () => {
          const collections = getCollections()
          if (collections.length === 0) {
            const name = prompt('Collection name:')
            if (name?.trim()) {
              collectionActions.createCollection(name, [idx])
              showToast(`Collection "${name.trim()}" created`, 'success')
            }
            return
          }
          const subItems: ContextMenuItem[] = collections.map((col) => ({
            label: `${col.name} (${col.indices.length})`,
            action: () => {
              collectionActions.addToCollection(col.id, [idx])
              showToast(`Shot added to "${col.name}"`, 'success')
            },
          }))
          subItems.push({ separator: true })
          subItems.push({
            label: 'New Collection...',
            action: () => {
              const name = prompt('Collection name:')
              if (name?.trim()) {
                collectionActions.createCollection(name, [idx])
                showToast(`Collection "${name.trim()}" created`, 'success')
              }
            },
          })
          showContextMenu(subItems, e.clientX, e.clientY)
        },
      },
    ]

    showContextMenu(items, e.clientX, e.clientY)
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="shot-card"
  class:favorite={isFavorite}
  class:selected={isSelected}
  class:deleted={isDeleted}
  class:current={isCurrent}
  onclick={handleClick}
  oncontextmenu={handleContextMenu}
>
  <button
    class="fav-star"
    aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    onclick={(e) => { e.stopPropagation(); selectionActions.toggleFavorite(scene.originalIdx) }}
  >
    {isFavorite ? '\u2605' : '\u2606'}
  </button>

  {#if isSelected}
    <div class="sel-badge">\u2713</div>
  {/if}

  <div class="shot-card-thumb">
    <img
      src={thumbSrc}
      loading="lazy"
      alt="Shot {scene.originalIdx + 1}"
    />
  </div>

  <div class="shot-card-footer">
    <div class="shot-card-tc">
      #{scene.originalIdx + 1} — {formatTimecode(scene.startTime)}
    </div>
  </div>
</div>

<style>
  .shot-card {
    position: relative;
    border-radius: var(--radius-md);
    overflow: hidden;
    cursor: pointer;
    border: 2px solid transparent;
    background: var(--bg-2);
    transition: border-color var(--transition-fast);
  }

  .shot-card:hover {
    border-color: var(--border-bright);
  }

  .shot-card.current {
    border-color: var(--accent);
  }

  .shot-card.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent-glow);
  }

  .shot-card.favorite .fav-star {
    color: var(--amber);
  }

  .shot-card.deleted {
    opacity: 0.4;
  }

  .fav-star {
    position: absolute;
    top: var(--sp-xs);
    right: var(--sp-xs);
    z-index: 2;
    font-size: 14px;
    color: var(--text-2);
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    background: rgba(0, 0, 0, 0.5);
    opacity: 0;
    transition: opacity var(--transition-fast);
  }

  .shot-card:hover .fav-star,
  .shot-card.favorite .fav-star {
    opacity: 1;
  }

  .fav-star:hover {
    color: var(--amber);
  }

  .sel-badge {
    position: absolute;
    top: var(--sp-xs);
    left: var(--sp-xs);
    z-index: 2;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .shot-card-thumb {
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: var(--bg-3);
  }

  .shot-card-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .shot-card-footer {
    padding: var(--sp-xs) var(--sp-sm);
    height: 32px;
    display: flex;
    align-items: center;
  }

  .shot-card-tc {
    font-size: var(--fs-secondary);
    font-family: var(--font-mono);
    color: var(--text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
