<script lang="ts">
  // EmptyState.svelte — Kein Video / Keine Szenen

  import { getVideoPath } from '../../lib/stores'
</script>

<div class="empty-state">
  {#if getVideoPath()}
    <div class="empty-state-title">No Scenes Detected</div>
    <div class="empty-state-hint">Click "Detect Scenes" to analyze the video</div>
  {:else}
    <div class="empty-state-title">No Video Loaded</div>
    <div class="empty-state-hint">Drop a video or click Open Video to begin</div>
  {/if}
</div>

<style>
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-2);
    text-align: center;
    padding: var(--sp-2xl);
  }

  .empty-state-title {
    font-size: var(--fs-heading);
    font-weight: 600;
    color: var(--text-1);
    margin-bottom: var(--sp-md);
  }

  .empty-state-hint {
    font-size: var(--fs-content);
    color: var(--text-2);
  }
</style>
