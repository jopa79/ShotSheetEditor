<script lang="ts">
  // TranscriptionPanel.svelte — Whisper-Transkription starten + Segmente anzeigen.
  // Hinweis: benoetigt ein lokales whisper.cpp-Binary (WHISPER_BIN/WHISPER_MODEL).

  import Modal from '../shared/Modal.svelte'
  import Button from '../shared/Button.svelte'
  import * as transcriptionActions from '../../lib/actions/transcriptionActions'
  import {
    getTranscriptionSegments,
    getIsTranscribing,
    getTranscriptionProgress,
  } from '../../lib/stores'
  import { formatTimecode } from '../../lib/utils/timecode'
  import type { WhisperModel } from '../../../../shared/models'

  interface Props {
    open: boolean
    onclose?: () => void
  }

  let { open, onclose }: Props = $props()

  const models: WhisperModel[] = ['tiny', 'base', 'small', 'medium']
  let model = $state<WhisperModel>('base')
</script>

<Modal {open} {onclose}>
  <div class="transcription">
    <h2>Transcription (Whisper)</h2>

    <div class="controls">
      <select bind:value={model} disabled={getIsTranscribing()}>
        {#each models as m (m)}
          <option value={m}>{m}</option>
        {/each}
      </select>

      {#if getIsTranscribing()}
        <Button size="sm" variant="ghost" onclick={() => transcriptionActions.cancelTranscription()}>
          Cancel
        </Button>
        <span class="status">Transcribing… {getTranscriptionProgress()}%</span>
      {:else}
        <Button size="sm" onclick={() => transcriptionActions.startTranscription(model)}>Start</Button>
      {/if}
    </div>

    <div class="segments">
      {#each getTranscriptionSegments() as seg (seg.id)}
        <div class="segment">
          <span class="time">{formatTimecode(seg.startTime)}</span>
          <span class="text">{seg.text}</span>
        </div>
      {:else}
        <p class="empty">No transcription yet — pick a model and Start.</p>
      {/each}
    </div>
  </div>
</Modal>

<style>
  .transcription {
    min-width: 520px;
    max-width: 640px;
    padding: var(--sp-md);
  }
  .transcription h2 {
    margin: 0 0 var(--sp-md);
    font-size: var(--fs-heading);
  }
  .controls {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    margin-bottom: var(--sp-md);
  }
  .controls select {
    padding: 4px 8px;
    background: var(--bg-0);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-1);
    font: inherit;
  }
  .status {
    font-size: var(--fs-secondary);
    color: var(--accent);
  }
  .segments {
    max-height: 320px;
    overflow-y: auto;
    border-top: 1px solid var(--border);
    padding-top: var(--sp-sm);
  }
  .segment {
    display: flex;
    gap: var(--sp-sm);
    padding: 4px 0;
    font-size: var(--fs-secondary);
  }
  .segment .time {
    flex-shrink: 0;
    color: var(--text-2);
    font-variant-numeric: tabular-nums;
  }
  .empty {
    color: var(--text-2);
    font-size: var(--fs-secondary);
  }
</style>
