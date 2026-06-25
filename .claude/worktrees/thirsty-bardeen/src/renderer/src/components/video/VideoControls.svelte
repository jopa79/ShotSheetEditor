<script lang="ts">
  // VideoControls.svelte — Play/Pause, Timecode, Prev/Next
  // Reine Darstellungskomponente — Logik kommt per Props

  import { formatTimecode } from '../../lib/utils/timecode'
  import Button from '../shared/Button.svelte'

  interface Props {
    isPlaying: boolean
    currentTime: number
    duration: number
    onPlayPause: () => void
    onPrev: () => void
    onNext: () => void
  }

  let { isPlaying, currentTime, duration, onPlayPause, onPrev, onNext }: Props = $props()
</script>

<div class="video-controls">
  <div class="controls-left">
    <Button size="sm" variant="ghost" onclick={onPrev} title="Previous Shot">&lsaquo;</Button>
    <Button size="sm" onclick={onPlayPause} title={isPlaying ? 'Pause' : 'Play'}>
      {isPlaying ? '\u23F8' : '\u25B6'}
    </Button>
    <Button size="sm" variant="ghost" onclick={onNext} title="Next Shot">&rsaquo;</Button>
  </div>

  <div class="timecode-display">
    {formatTimecode(currentTime)} / {formatTimecode(duration)}
  </div>
</div>

<style>
  .video-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sp-xs) var(--sp-sm);
    background: var(--bg-2);
    border-bottom: 1px solid var(--border);
    -webkit-app-region: no-drag;
  }

  .controls-left {
    display: flex;
    align-items: center;
    gap: var(--sp-xs);
  }

  .timecode-display {
    font-size: var(--fs-secondary);
    font-family: var(--font-mono);
    color: var(--text-2);
    white-space: nowrap;
  }
</style>
