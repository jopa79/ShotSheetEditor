<script lang="ts">
  // VideoControls.svelte — Play/Pause, Timecode, Prev/Next
  // Reine Darstellungskomponente — Logik kommt per Props
  // Dunkles NLE-Design (DaVinci Resolve / Premiere Pro Stil)

  import { formatTimecode } from '../../lib/utils/timecode'

  interface Props {
    isPlaying: boolean
    currentTime: number
    duration: number
    disabled?: boolean
    onPlayPause: () => void
    onPrev: () => void
    onNext: () => void
  }

  let { isPlaying, currentTime, duration, disabled = false, onPlayPause, onPrev, onNext }: Props =
    $props()
</script>

<div class="video-controls" class:is-disabled={disabled}>
  <!-- Transport-Buttons: Prev | Play/Pause | Next — zentriert -->
  <div class="transport-group">
    <button
      class="transport-btn transport-btn--ghost"
      onclick={onPrev}
      title="Vorheriger Shot"
      {disabled}
      aria-label="Vorheriger Shot"
    >
      <!-- Prev-Icon: Strich links + Chevron links -->
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <rect x="1" y="2" width="1.5" height="8" rx="0.5" fill="currentColor" />
        <path d="M10 1.5L4.5 6L10 10.5V1.5Z" fill="currentColor" />
      </svg>
    </button>

    <button
      class="transport-btn transport-btn--play"
      onclick={onPlayPause}
      title={isPlaying ? 'Pause' : 'Abspielen'}
      {disabled}
      aria-label={isPlaying ? 'Pause' : 'Abspielen'}
    >
      {#if isPlaying}
        <!-- Pause-Icon: Zwei vertikale Balken -->
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <rect x="2.5" y="1.5" width="2.5" height="9" rx="0.75" fill="currentColor" />
          <rect x="7" y="1.5" width="2.5" height="9" rx="0.75" fill="currentColor" />
        </svg>
      {:else}
        <!-- Play-Icon: Dreieck nach rechts -->
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M3 1.5L10.5 6L3 10.5V1.5Z" fill="currentColor" />
        </svg>
      {/if}
    </button>

    <button
      class="transport-btn transport-btn--ghost"
      onclick={onNext}
      title="Naechster Shot"
      {disabled}
      aria-label="Naechster Shot"
    >
      <!-- Next-Icon: Chevron rechts + Strich rechts -->
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M2 1.5L7.5 6L2 10.5V1.5Z" fill="currentColor" />
        <rect x="9.5" y="2" width="1.5" height="8" rx="0.5" fill="currentColor" />
      </svg>
    </button>
  </div>

  <!-- Timecode-Anzeige: rechts ausgerichtet -->
  <div class="timecode-display">
    <span class="timecode-current">{formatTimecode(currentTime)}</span>
    <span class="timecode-separator">/</span>
    <span class="timecode-duration">{formatTimecode(duration)}</span>
  </div>
</div>

<style>
  /* === Container === */
  .video-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    height: 36px;
    padding: var(--sp-sm) var(--sp-md);
    background: var(--bg-2);
    border-bottom: 1px solid var(--border);
    -webkit-app-region: no-drag;
  }

  /* Deaktivierter Zustand fuer gesamte Leiste */
  .video-controls.is-disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  /* === Transport-Gruppe (Prev | Play | Next) — zentriert === */
  .transport-group {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
  }

  /* === Basis-Button-Reset === */
  .transport-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    padding: 0;
    transition:
      background var(--transition-fast),
      color var(--transition-fast),
      box-shadow var(--transition-fast);
    flex-shrink: 0;
  }

  .transport-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* === Ghost-Buttons (Prev / Next) — 26x26px === */
  .transport-btn--ghost {
    width: 26px;
    height: 26px;
    background: transparent;
    color: var(--text-1);
  }

  .transport-btn--ghost:hover:not(:disabled) {
    background: var(--bg-4);
    color: var(--text-0);
  }

  .transport-btn--ghost:active:not(:disabled) {
    background: var(--border);
  }

  /* === Play/Pause-Button — 30x30px mit Akzentfarbe === */
  .transport-btn--play {
    width: 30px;
    height: 30px;
    background: var(--accent);
    color: #ffffff;
    box-shadow: 0 0 0 0 var(--accent-glow);
  }

  .transport-btn--play:hover:not(:disabled) {
    background: var(--accent);
    box-shadow: 0 0 12px 2px var(--accent-glow);
    filter: brightness(1.15);
  }

  .transport-btn--play:active:not(:disabled) {
    filter: brightness(0.9);
    box-shadow: none;
  }

  /* === Timecode-Anzeige — absolut rechts positioniert === */
  .timecode-display {
    position: absolute;
    right: var(--sp-md);
    display: flex;
    align-items: center;
    gap: 3px;
    font-family: var(--font-mono);
    font-size: var(--fs-content);
    line-height: 1;
    white-space: nowrap;
    user-select: none;
  }

  .timecode-current {
    color: var(--text-1);
  }

  .timecode-separator {
    color: var(--text-2);
    margin: 0 1px;
  }

  .timecode-duration {
    color: var(--text-2);
  }
</style>
