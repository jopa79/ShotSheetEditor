// transcriptionActions.ts — Whisper-Transkription starten/abbrechen.

import {
  getVideoPath,
  getIsTranscribing,
  setTranscriptionSegments,
  setIsTranscribing,
  setTranscriptionProgress,
} from '../stores'
import * as ipc from '../ipc/bridge'
import { showToast } from './toastManager'
import type { WhisperModel } from '../../../../shared/models'

/**
 * Transkription starten. Segmente erscheinen progressiv (via onTranscriptionProgress).
 */
export async function startTranscription(model: WhisperModel = 'base'): Promise<void> {
  if (getIsTranscribing()) return // bereits ein Lauf aktiv
  const videoPath = getVideoPath()
  if (!videoPath) {
    showToast('No video loaded', 'warning')
    return
  }

  setIsTranscribing(true)
  setTranscriptionSegments([])
  setTranscriptionProgress(0)

  // Progressive Segmente waehrend der Transkription
  const cleanup = ipc.onTranscriptionProgress((p) => {
    if (p.segments) setTranscriptionSegments(p.segments)
    setTranscriptionProgress(p.percent)
  })

  try {
    const result = await ipc.startTranscription({ videoPath, model })
    if (result.success && result.segments) {
      setTranscriptionSegments(result.segments)
      showToast(`Transcribed ${result.segments.length} segments`, 'success')
    } else {
      showToast(`Transcription failed: ${result.error ?? 'Unknown error'}`, 'error')
    }
  } catch (err) {
    showToast(`Transcription failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
  } finally {
    cleanup()
    setIsTranscribing(false)
  }
}

/** Laufende Transkription abbrechen. */
export function cancelTranscription(): Promise<{ success: boolean }> {
  return ipc.cancelTranscription()
}
