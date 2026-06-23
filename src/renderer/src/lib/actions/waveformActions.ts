// waveformActions.ts — Waveform fuer das aktuelle Video erzeugen.
//
// Flow: Video → Audio extrahieren (WAV) → Peaks berechnen → in den Store.

import { getVideoPath, setWaveform, setIsGeneratingWaveform } from '../stores'
import * as ipc from '../ipc/bridge'
import { showToast } from './toastManager'

/**
 * Erzeugt die Waveform fuer das geladene Video (Audio-Extraktion + Peak-Berechnung).
 */
export async function generateWaveform(): Promise<void> {
  const videoPath = getVideoPath()
  if (!videoPath) {
    showToast('No video loaded', 'warning')
    return
  }

  setIsGeneratingWaveform(true)
  try {
    // 1. Audiospur als WAV extrahieren
    const audioResult = await ipc.extractAudio({ videoPath })
    if (!audioResult.success || !audioResult.audioPath) {
      showToast(`Waveform failed: ${audioResult.error ?? 'audio extraction failed'}`, 'error')
      return
    }

    // 2. Peaks aus der WAV berechnen
    const result = await ipc.generateWaveform({ audioPath: audioResult.audioPath })
    if (result.success && result.data) {
      setWaveform(result.data)
      showToast('Waveform generated', 'success')
    } else {
      showToast(`Waveform failed: ${result.error ?? 'Unknown error'}`, 'error')
    }
  } catch (err) {
    showToast(`Waveform failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
  } finally {
    setIsGeneratingWaveform(false)
  }
}
