<script lang="ts">
  // ProgressOverlay.svelte — Fortschrittsanzeige für Transcoding/Detection

  interface Props {
    visible: boolean
    title: string
    progress: number
    oncancel?: () => void
  }

  let { visible, title, progress, oncancel }: Props = $props()
</script>

{#if visible}
  <div class="progress-overlay">
    <div class="progress-content">
      <div class="progress-title">{title}</div>
      <div class="progress-bar">
        <div class="progress-bar-fill" style="width: {progress}%"></div>
      </div>
      <div class="progress-text">{progress}%</div>
      {#if oncancel}
        <button class="progress-cancel" onclick={oncancel}>Cancel</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .progress-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
    z-index: 7000;
  }

  .progress-content {
    text-align: center;
    padding: var(--sp-2xl);
  }

  .progress-title {
    font-size: var(--fs-emphasized);
    color: var(--text-0);
    margin-bottom: var(--sp-lg);
  }

  .progress-bar {
    width: 200px;
    height: 4px;
    background: var(--bg-4);
    border-radius: 2px;
    overflow: hidden;
    margin: 0 auto var(--sp-md);
  }

  .progress-bar-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    transition: width var(--transition-fast);
  }

  .progress-text {
    font-size: var(--fs-content);
    color: var(--text-1);
    font-family: var(--font-mono);
    margin-bottom: var(--sp-lg);
  }

  .progress-cancel {
    padding: var(--sp-sm) var(--sp-lg);
    font-size: var(--fs-content);
    color: var(--text-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .progress-cancel:hover {
    color: var(--text-0);
    border-color: var(--border-bright);
    background: var(--bg-3);
  }
</style>
