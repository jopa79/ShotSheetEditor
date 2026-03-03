<script lang="ts">
  // Statusbar.svelte — Statusleiste unten

  import { getScenes, getThreshold, getIsDetecting, getDetectProgress } from '../../lib/stores'

  interface Props {
    version: string
    ffmpegAvailable: boolean
  }

  let { version, ffmpegAvailable }: Props = $props()
</script>

<footer class="statusbar">
  <div class="statusbar-left">
    <span class="status-item">
      {getScenes().length} Scenes
    </span>
    {#if getIsDetecting()}
      <span class="status-item detecting">
        Detecting {getDetectProgress()}%
      </span>
    {/if}
  </div>

  <div class="statusbar-right">
    <span class="status-item">Threshold: {getThreshold().toFixed(2)}</span>
    <span class="status-item">v{version}</span>
    <span class="status-item" class:status-ok={ffmpegAvailable} class:status-warn={!ffmpegAvailable}>
      FFmpeg {ffmpegAvailable ? 'OK' : 'Missing'}
    </span>
  </div>
</footer>

<style>
  .statusbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 22px;
    padding: 0 var(--sp-lg);
    background: var(--bg-1);
    border-top: 1px solid var(--border);
    font-size: var(--fs-secondary);
    color: var(--text-2);
    -webkit-app-region: no-drag;
  }

  .statusbar-left,
  .statusbar-right {
    display: flex;
    align-items: center;
    gap: var(--sp-lg);
  }

  .status-item {
    white-space: nowrap;
  }

  .detecting {
    color: var(--accent);
  }

  .status-ok {
    color: var(--green);
  }

  .status-warn {
    color: var(--amber);
  }
</style>
