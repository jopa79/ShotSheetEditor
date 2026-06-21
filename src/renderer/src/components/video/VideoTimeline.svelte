<script lang="ts">
  // VideoTimeline.svelte — Timeline mit Playhead, Scene-Markern und Scrubbing
  // Zeigt Clip-Dauer, aktuelle Position und Szenen-Verteilung

  import type { Scene } from '../../../../shared/models'

  interface Props {
    currentTime: number
    duration: number
    scenes: Scene[]
    onSeek: (time: number) => void
  }

  let { currentTime, duration, scenes, onSeek }: Props = $props()

  let trackEl: HTMLDivElement | undefined = $state()
  let isDragging = $state(false)

  // Playhead-Position in Prozent
  let progressPercent = $derived(
    duration > 0 ? (currentTime / duration) * 100 : 0
  )

  // Maus-Position → Zeit berechnen
  function positionToTime(clientX: number): number {
    if (!trackEl || duration <= 0) return 0
    const rect = trackEl.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * duration
  }

  // Klick auf Timeline → Seek
  function handleClick(e: MouseEvent) {
    if (isDragging) return
    onSeek(positionToTime(e.clientX))
  }

  // Drag-Scrubbing: mousedown → mousemove → mouseup
  function handleMouseDown(e: MouseEvent) {
    e.preventDefault()
    isDragging = true
    onSeek(positionToTime(e.clientX))

    function handleMouseMove(ev: MouseEvent) {
      onSeek(positionToTime(ev.clientX))
    }

    function handleMouseUp() {
      isDragging = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="timeline"
  bind:this={trackEl}
  onclick={handleClick}
  onmousedown={handleMouseDown}
>
  <!-- Progress-Fläche (links vom Playhead) -->
  <div class="timeline-progress" style="width: {progressPercent}%"></div>

  <!-- Scene-Marker -->
  {#each scenes as scene (scene.index)}
    {#if duration > 0 && Number.isFinite(scene.startTime)}
      <div
        class="scene-marker"
        style="left: {(scene.startTime / duration) * 100}%"
      ></div>
    {/if}
  {/each}

  <!-- Playhead -->
  <div class="playhead" style="left: {progressPercent}%"></div>
</div>

<style>
  .timeline {
    position: relative;
    height: 24px;
    background: var(--bg-4);
    cursor: pointer;
    overflow: hidden;
    flex-shrink: 0;
    -webkit-app-region: no-drag;
  }

  .timeline-progress {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: var(--accent-glow);
    pointer-events: none;
  }

  .scene-marker {
    position: absolute;
    top: 0;
    width: 1px;
    height: 100%;
    background: var(--border-bright);
    pointer-events: none;
    opacity: 0.6;
  }

  .playhead {
    position: absolute;
    top: 0;
    width: 2px;
    height: 100%;
    background: var(--accent);
    pointer-events: none;
    transform: translateX(-1px);
    /* Subtiler Glow-Effekt */
    box-shadow: 0 0 4px var(--accent-glow);
  }
</style>
