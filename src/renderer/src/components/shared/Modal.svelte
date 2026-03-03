<script lang="ts">
  // Modal.svelte — Wiederverwendbarer Modal-Dialog
  // Props: open, onclose, noBackdropClose, showCloseButton

  import type { Snippet } from 'svelte'

  interface Props {
    open: boolean
    onclose?: () => void
    noBackdropClose?: boolean
    showCloseButton?: boolean
    children: Snippet
  }

  let { open, onclose, noBackdropClose = false, showCloseButton = true, children }: Props = $props()

  function handleBackdropClick(e: MouseEvent) {
    if (!noBackdropClose && e.target === e.currentTarget) {
      onclose?.()
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onclose?.()
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
  >
    <div class="modal" role="dialog" aria-modal="true">
      {#if showCloseButton}
        <button class="modal-close" onclick={() => onclose?.()}>×</button>
      {/if}
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    z-index: 8000;
  }

  .modal {
    position: relative;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--sp-xl);
    box-shadow: var(--shadow-lg);
    min-width: 300px;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
  }

  .modal-close {
    position: absolute;
    top: var(--sp-md);
    right: var(--sp-md);
    font-size: 18px;
    color: var(--text-2);
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
  }

  .modal-close:hover {
    color: var(--text-0);
    background: var(--bg-3);
  }
</style>
