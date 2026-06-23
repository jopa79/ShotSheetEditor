<script lang="ts">
  // WaveformDisplay.svelte — Canvas-Visualisierung der Audio-Peaks
  // Zeichnet die normalisierten Peaks (0..1) als symmetrische Balken + Playhead.
  // Klick seekt zur entsprechenden Zeit (via onSeek-Callback).

  interface Props {
    peaks: number[]
    currentTime: number
    duration: number
    onSeek?: (time: number) => void
  }

  let { peaks, currentTime, duration, onSeek }: Props = $props()

  let canvas: HTMLCanvasElement | undefined = $state()

  // Neu zeichnen wenn sich Peaks oder Playhead-Position aendern
  $effect(() => {
    // Abhaengigkeiten explizit lesen, damit der Effekt reagiert
    void peaks
    void currentTime
    void duration
    draw()
  })

  function draw(): void {
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = (canvas.width = canvas.clientWidth || 1)
    const height = (canvas.height = canvas.clientHeight || 1)
    ctx.clearRect(0, 0, width, height)

    if (peaks.length === 0) return

    const mid = height / 2
    const barWidth = width / peaks.length
    const accent = getComputedStyle(canvas).getPropertyValue('--accent').trim() || '#4a9eff'

    // Peaks zeichnen (symmetrisch um die Mitte)
    ctx.fillStyle = accent
    for (let i = 0; i < peaks.length; i++) {
      const amp = Math.max(0, Math.min(1, peaks[i])) * mid
      const x = i * barWidth
      ctx.fillRect(x, mid - amp, Math.max(1, barWidth * 0.8), amp * 2)
    }

    // Playhead
    if (duration > 0) {
      const x = Math.min(width, Math.max(0, (currentTime / duration) * width))
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
  }

  function handleClick(e: MouseEvent): void {
    if (!canvas || !onSeek || duration <= 0) return
    const rect = canvas.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    onSeek(Math.max(0, Math.min(1, ratio)) * duration)
  }

  // Tastatur-Seek (role=slider erwartet Pfeiltasten-Navigation)
  const SEEK_STEP_SECONDS = 5
  function handleKeydown(e: KeyboardEvent): void {
    if (!onSeek || duration <= 0) return
    if (e.key === 'ArrowLeft') {
      onSeek(Math.max(0, currentTime - SEEK_STEP_SECONDS))
      e.preventDefault()
    } else if (e.key === 'ArrowRight') {
      onSeek(Math.min(duration, currentTime + SEEK_STEP_SECONDS))
      e.preventDefault()
    }
  }
</script>

<canvas
  bind:this={canvas}
  class="waveform"
  onclick={handleClick}
  onkeydown={handleKeydown}
  role="slider"
  tabindex="0"
  aria-label="Audio waveform — click or arrow keys to seek"
  aria-valuenow={Math.round(currentTime)}
  aria-valuemin={0}
  aria-valuemax={Math.round(duration)}
></canvas>

<style>
  .waveform {
    display: block;
    width: 100%;
    height: 56px;
    background: var(--bg-1);
    border-top: 1px solid var(--border);
    cursor: pointer;
  }
</style>
