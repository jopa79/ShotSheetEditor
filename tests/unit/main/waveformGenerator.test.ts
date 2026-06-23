// waveformGenerator.test.ts — WAV-Parsing + Peak-Berechnung.
// Mockt fs.readFileSync (synthetische WAV) und pathSecurity (pass-through).

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { state } = vi.hoisted(() => ({ state: { buf: Buffer.alloc(0), size: -1 } }))

vi.mock('../../../src/main/pathSecurity', () => ({
  validateForRead: (p: string) => p,
}))

vi.mock('fs', () => {
  const statSync = () => ({ size: state.size >= 0 ? state.size : state.buf.length })
  return {
    default: { readFileSync: () => state.buf, statSync },
    readFileSync: () => state.buf,
    statSync,
  }
})

/** Minimale 16-bit PCM Mono WAV aus Samples bauen. */
function makeWav(samples: number[], sampleRate = 16000, bitsPerSample = 16): Buffer {
  const dataSize = samples.length * 2
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // Mono
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(bitsPerSample, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(samples[i], 44 + i * 2)
  return buf
}

describe('waveformGenerator', () => {
  beforeEach(() => {
    state.buf = Buffer.alloc(0)
    state.size = -1 // -1 = echte buf.length verwenden
  })

  it('berechnet normalisierte Peaks pro Bucket (laut → ~1.0, Stille → 0)', async () => {
    // 4 Frames: 2x laut, 2x Stille → numPeaks 2 → [~1, 0]
    state.buf = makeWav([32767, 32767, 0, 0])
    const { generateWaveform } = await import('../../../src/main/waveformGenerator')
    const res = await generateWaveform({ audioPath: '/a.wav', numPeaks: 2 })

    expect(res.success).toBe(true)
    expect(res.data!.peaks).toHaveLength(2)
    expect(res.data!.peaks[0]).toBeGreaterThan(0.99)
    expect(res.data!.peaks[1]).toBe(0)
    res.data!.peaks.forEach((p) => {
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(1)
    })
  })

  it('liefert sampleRate und duration korrekt', async () => {
    state.buf = makeWav(new Array(16000).fill(1000), 16000) // 1 Sekunde
    const { generateWaveform } = await import('../../../src/main/waveformGenerator')
    const res = await generateWaveform({ audioPath: '/a.wav', numPeaks: 100 })

    expect(res.data!.sampleRate).toBe(16000)
    expect(res.data!.duration).toBeCloseTo(1.0, 3)
  })

  it('respektiert numPeaks (Default 1000)', async () => {
    state.buf = makeWav(new Array(5000).fill(500))
    const { generateWaveform } = await import('../../../src/main/waveformGenerator')
    const res = await generateWaveform({ audioPath: '/a.wav' })
    expect(res.data!.peaks).toHaveLength(1000)
  })

  it('Fehler bei zu kleiner Datei (kein gueltiges WAV)', async () => {
    state.buf = Buffer.alloc(10)
    const { generateWaveform } = await import('../../../src/main/waveformGenerator')
    const res = await generateWaveform({ audioPath: '/a.wav' })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/invalid wav/i)
  })

  it('Fehler bei nicht-16-bit PCM', async () => {
    state.buf = makeWav([100, 200, 300, 400], 16000, 24) // 24-bit Header
    const { generateWaveform } = await import('../../../src/main/waveformGenerator')
    const res = await generateWaveform({ audioPath: '/a.wav', numPeaks: 2 })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/bit depth|failed/i)
  })

  it('clamped numPeaks=Infinity auf den Default (kein Array-Crash)', async () => {
    state.buf = makeWav(new Array(2000).fill(800))
    const { generateWaveform } = await import('../../../src/main/waveformGenerator')
    const res = await generateWaveform({ audioPath: '/a.wav', numPeaks: Infinity })
    expect(res.success).toBe(true)
    expect(res.data!.peaks).toHaveLength(1000) // Default, nicht Infinity
  })

  it('lehnt zu grosse Dateien ab (OOM-Schutz)', async () => {
    state.buf = makeWav([100, 200, 300, 400])
    state.size = 600 * 1024 * 1024 // 600 MB > Limit
    const { generateWaveform } = await import('../../../src/main/waveformGenerator')
    const res = await generateWaveform({ audioPath: '/a.wav' })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/too large/i)
  })

  it('weniger Frames als numPeaks → leere Trailing-Buckets, kein Crash', async () => {
    state.buf = makeWav([32767, 0, 32767]) // 3 Frames, 10 Peaks
    const { generateWaveform } = await import('../../../src/main/waveformGenerator')
    const res = await generateWaveform({ audioPath: '/a.wav', numPeaks: 10 })
    expect(res.success).toBe(true)
    expect(res.data!.peaks).toHaveLength(10)
    expect(res.data!.peaks.some((p) => p > 0.9)).toBe(true) // laute Frames erfasst
  })
})
