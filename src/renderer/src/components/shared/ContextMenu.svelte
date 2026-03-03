<script lang="ts" module>
  // Modul-Level Export — wird von anderen Komponenten importiert
  export interface ContextMenuItem {
    label?: string
    action?: () => void
    separator?: boolean
  }
</script>

<script lang="ts">
  // ContextMenu.svelte — Rechtsklick-Menü (Singleton)
  // Wird über contextMenuManager gesteuert

  let items = $state<ContextMenuItem[]>([])
  let x = $state(0)
  let y = $state(0)
  let visible = $state(false)
  let menuEl: HTMLDivElement | undefined = $state()

  /** Menü öffnen — wird von contextMenuManager aufgerufen */
  export function show(menuItems: ContextMenuItem[], posX: number, posY: number) {
    items = menuItems
    x = posX
    y = posY
    visible = true
  }

  /** Menü schließen */
  export function hide() {
    visible = false
    items = []
  }

  function handleItemClick(item: ContextMenuItem) {
    item.action?.()
    hide()
  }

  // Viewport-Begrenzung nach dem Rendern (Fix #163)
  $effect(() => {
    if (visible && menuEl) {
      const rect = menuEl.getBoundingClientRect()
      const vpW = window.innerWidth
      const vpH = window.innerHeight
      if (x + rect.width > vpW) {
        x = Math.max(0, vpW - rect.width)
      }
      if (y + rect.height > vpH) {
        y = Math.max(0, y - rect.height)
      }
    }
  })

  // Click-Outside schließt das Menü
  $effect(() => {
    if (!visible) return

    function handleClickOutside(e: MouseEvent) {
      if (menuEl && !menuEl.contains(e.target as Node)) {
        hide()
      }
    }

    // setTimeout: Click-Event des Auslösers nicht abfangen
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClickOutside)
    }
  })
</script>

{#if visible}
  <div
    class="ctx-menu"
    bind:this={menuEl}
    style="left: {x}px; top: {y}px;"
  >
    {#each items as item}
      {#if item.separator}
        <div class="ctx-menu-divider"></div>
      {:else}
        <button
          class="ctx-menu-item"
          onclick={() => handleItemClick(item)}
        >
          {item.label}
        </button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .ctx-menu {
    position: fixed;
    z-index: 9000;
    min-width: 180px;
    background: var(--bg-2);
    border: 1px solid var(--border-bright);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    padding: var(--sp-sm) 0;
    -webkit-app-region: no-drag;
  }

  .ctx-menu-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: var(--sp-sm) var(--sp-lg);
    font-size: var(--fs-content);
    color: var(--text-0);
  }

  .ctx-menu-item:hover {
    background: var(--accent-glow);
    color: var(--accent);
  }

  .ctx-menu-divider {
    height: 1px;
    background: var(--border);
    margin: var(--sp-sm) 0;
  }
</style>
