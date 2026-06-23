// waveformGenerator.ts — Berechnet Waveform-Peaks aus einer WAV-Datei.
//
// Liest 16-bit PCM (pcm_s16le, wie von audioExtractor erzeugt), teilt die
// Samples in numPeaks Buckets und nimmt pro Bucket die maximale Amplitude
// (normalisiert 0..1). Reine Berechnung — kein ffmpeg, gut testbar.

import fs from 'fs'
import { WAVEFORM_DEFAULTS } from '../shared/constants'
import type { WaveformGenerateRequest, WaveformGenerateResponse } from '../shared/ipcPayloads'
import type { WaveformPeaks } from '../shared/models'
import { validateForRead } from './pathSecurity'

const WAV_HEADER_MIN_BYTES = 44
// 16-bit Samples liegen in -32768..32767 → Division durch 32768 haelt die
// Peaks sicher in [0,1] (auch der Extremwert -32768 ergibt genau 1.0).
const INT16_MAX = 32768
const MAX_WAV_SIZE_BYTES = 500 * 1024 * 1024 // 500 MB — Schutz gegen OOM
const MAX_PEAKS = 100_000 // Obergrenze gegen Infinity/Riesen-Arrays

/** WAV-Header parsen + Peaks pro Bucket (max. Amplitude) berechnen. */
function _computePeaks(buffer: Buffer, numPeaks: number): WaveformPeaks {
  const sampleRate = buffer.readUInt32LE(24)
  const bitsPerSample = buffer.readUInt16LE(34)
  const numChannels = Math.max(1, buffer.readUInt16LE(22))

  if (bitsPerSample !== 16) {
    throw new Error(`Unsupported bit depth: ${bitsPerSample} (only 16-bit PCM)`)
  }

  // 'data'-Chunk suchen (robust gegen optionale Chunks vor 'data')
  let offset = 12
  let dataOffset = WAV_HEADER_MIN_BYTES
  let dataSize = buffer.length - WAV_HEADER_MIN_BYTES
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    if (chunkId === 'data') {
      dataOffset = offset + 8
      dataSize = Math.min(chunkSize, buffer.length - dataOffset)
      break
    }
    offset += 8 + chunkSize + (chunkSize % 2) // Chunks sind 2-Byte-aligned
  }

  const bytesPerSample = 2 // 16-bit
  const frameSize = bytesPerSample * numChannels
  const numFrames = Math.floor(dataSize / frameSize)

  const safeNumPeaks = Math.max(1, Math.floor(numPeaks))
  const peaks: number[] = new Array(safeNumPeaks).fill(0)
  const framesPerBucket = Math.max(1, Math.floor(numFrames / safeNumPeaks))

  for (let p = 0; p < safeNumPeaks; p++) {
    let max = 0
    const start = p * framesPerBucket
    const end = Math.min(start + framesPerBucket, numFrames)
    for (let f = start; f < end; f++) {
      // Nur den ersten Kanal auswerten (Mono erwartet, robust bei Stereo)
      const sampleOffset = dataOffset + f * frameSize
      if (sampleOffset + 2 > buffer.length) break
      const abs = Math.abs(buffer.readInt16LE(sampleOffset))
      if (abs > max) max = abs
    }
    peaks[p] = max / INT16_MAX
  }

  const duration = sampleRate > 0 ? numFrames / sampleRate : 0
  return { peaks, sampleRate, duration }
}

/**
 * Generiert Waveform-Peaks aus einer (extrahierten) WAV-Datei.
 */
export async function generateWaveform(
  request: WaveformGenerateRequest,
): Promise<WaveformGenerateResponse> {
  // numPeaks robust begrenzen (gegen Infinity/NaN/Riesenwerte → Array-Crash)
  const rawNumPeaks = request.numPeaks ?? WAVEFORM_DEFAULTS.numPeaks
  const numPeaks = Number.isFinite(rawNumPeaks)
    ? Math.min(MAX_PEAKS, Math.max(1, Math.floor(rawNumPeaks)))
    : WAVEFORM_DEFAULTS.numPeaks

  // Audio-Pfad: Symlink-sicher, home + tmp erlaubt (Audio liegt i.d.R. in tmp)
  let safeAudioPath: string
  try {
    safeAudioPath = validateForRead(request.audioPath, { allowTmp: true })
  } catch {
    return { success: false, error: 'Access denied: audio path not found or outside allowed directories' }
  }

  try {
    // Groessen-Check vor dem Einlesen — verhindert OOM bei Riesen-Dateien
    if (fs.statSync(safeAudioPath).size > MAX_WAV_SIZE_BYTES) {
      return { success: false, error: 'WAV file too large' }
    }
    const buffer = fs.readFileSync(safeAudioPath)
    if (buffer.length < WAV_HEADER_MIN_BYTES) {
      return { success: false, error: 'Invalid WAV file (too small)' }
    }
    const data = _computePeaks(buffer, numPeaks)
    return { success: true, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Waveform generation failed: ${msg}` }
  }
}

export default { generateWaveform }
