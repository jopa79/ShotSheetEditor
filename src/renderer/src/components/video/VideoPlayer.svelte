<script lang="ts">
  // VideoPlayer.svelte — Video-Element + Controls
  // Ersetzt V1 videoPlayer.js (305 LOC)
  // Registriert loadVideo + pauseAndReset bei videoActions

  import VideoControls from './VideoControls.svelte'
  import {
    getVideoPath,
    getCurrentShotIdx,
    getScenes,
    getVisibleScenes,
    setCurrentShotIdx,
  } from '../../lib/stores'
  import { registerLoadVideo, registerPauseAndReset } from '../../lib/actions/videoActions'
  import {
    registerTogglePlayPause,
    registerPrevShot,
    registerNextShot,
  } from '../../lib/actions/shortcuts'

  // --- Video-Element Referenz ---
  let videoEl: HTMLVideoElement | undefined = $state()
  let isPlaying = $state(false)
  let currentTime = $state(0)
  let duration = $state(0)

  let hasVideo = $derived(getVideoPath() !== null)

  // --- loadVideo: Wird von videoActions aufgerufen ---
  function loadVideo(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!videoEl) {
        reject(new Error('Video element not found'))
        return
      }

      // Vorheriges Video pausieren (Fix #147)
      videoEl.pause()

      // Pfad in file:// URL konvertieren
      let videoUrl = filePath
      if (!videoUrl.startsWith('file://') && !videoUrl.startsWith('app://')) {
        videoUrl = 'file://' + (filePath.startsWith('/') ? '' : '/') + filePath
      }

      const timeoutId = setTimeout(() => {
        removeLoadListeners()
        console.error('VideoPlayer: loadVideo timeout — vermutlich inkompatibles Format')
        reject(new Error('Video-Load Timeout — Format nicht abspielbar'))
      }, 5000)

      function removeLoadListeners() {
        clearTimeout(timeoutId)
        videoEl!.removeEventListener('loadedmetadata', onLoaded)
        videoEl!.removeEventListener('error', onError)
      }

      function onLoaded() {
        removeLoadListeners()
        resolve()
      }

      function onError() {
        removeLoadListeners()
        const err = videoEl!.error
        console.error('VideoPlayer: loadVideo error', err?.message || 'unknown')
        reject(new Error(err?.message || 'Video konnte nicht geladen werden'))
      }

      videoEl.addEventListener('loadedmetadata', onLoaded, { once: true })
      videoEl.addEventListener('error', onError, { once: true })
      videoEl.src = videoUrl
      videoEl.load()
    })
  }

  // --- pauseAndReset: Video stoppen und Quelle leeren (Fix #147) ---
  function pauseAndReset(): void {
    if (!videoEl) return
    videoEl.pause()
    videoEl.src = ''
    videoEl.load()
    isPlaying = false
    currentTime = 0
    duration = 0
  }

  // --- Callbacks bei videoActions + shortcuts registrieren ---
  $effect(() => {
    registerLoadVideo(loadVideo)
    registerPauseAndReset(pauseAndReset)
    registerTogglePlayPause(togglePlayPause)
    registerPrevShot(prevShot)
    registerNextShot(nextShot)

    // Refs nullen statt No-Ops — verhindert Memory Leak durch Closures (fix #93)
    return () => {
      registerLoadVideo(null)
      registerPauseAndReset(null)
      registerTogglePlayPause(null)
      registerPrevShot(null)
      registerNextShot(null)
    }
  })

  // --- currentShotIdx → seekTo ---
  $effect(() => {
    const idx = getCurrentShotIdx()
    if (idx >= 0 && videoEl) {
      const scenes = getScenes()
      const scene = scenes[idx]
      if (scene && Number.isFinite(scene.startTime)) {
        videoEl.currentTime = scene.startTime
      }
    }
  })

  // --- Video-Events ---
  function handleTimeUpdate() {
    if (videoEl) {
      currentTime = videoEl.currentTime
      duration = videoEl.duration || 0
    }
  }

  function handlePlay() {
    isPlaying = true
  }

  function handlePause() {
    isPlaying = false
  }

  function handleLoadedMetadata() {
    if (videoEl) {
      duration = videoEl.duration || 0
    }
  }

  // --- Navigation ---
  function togglePlayPause(): void {
    if (!videoEl) return
    if (videoEl.paused) {
      videoEl.play().catch((err) => {
        console.error('VideoPlayer: play failed', err)
      })
    } else {
      videoEl.pause()
    }
  }

  function prevShot(): void {
    const scenes = getVisibleScenes()
    const idx = getCurrentShotIdx()
    if (scenes.length === 0) return

    let newIdx = -1
    for (const scene of scenes) {
      if (scene.originalIdx < idx) {
        newIdx = scene.originalIdx
      }
    }
    if (newIdx !== -1) {
      setCurrentShotIdx(newIdx)
    }
  }

  function nextShot(): void {
    const scenes = getVisibleScenes()
    const idx = getCurrentShotIdx()
    if (scenes.length === 0) return

    for (const scene of scenes) {
      if (scene.originalIdx > idx) {
        setCurrentShotIdx(scene.originalIdx)
        return
      }
    }
  }

</script>

{#if hasVideo}
  <div class="video-player">
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
      bind:this={videoEl}
      ontimeupdate={handleTimeUpdate}
      onplay={handlePlay}
      onpause={handlePause}
      onloadedmetadata={handleLoadedMetadata}
    ></video>

    <VideoControls
      {isPlaying}
      {currentTime}
      {duration}
      onPlayPause={togglePlayPause}
      onPrev={prevShot}
      onNext={nextShot}
    />
  </div>
{/if}

<style>
  .video-player {
    background: var(--bg-3);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  video {
    display: block;
    width: 100%;
    max-height: 240px;
    object-fit: contain;
    background: #000;
  }
</style>
