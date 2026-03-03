import { describe, it, expect } from 'vitest'
import {
  IPC_CHANNELS,
  WINDOW_DEFAULTS,
  DETECTION_DEFAULTS,
  THUMB_SIZE,
  SUPPORTED_FORMATS,
  EXPORT_CODECS,
  PROXY_CONFIG,
  AUTO_SAVE_INTERVAL_MS,
  QUIT_TIMEOUT_MS,
  secondsToTimecode,
} from '@shared/constants'

describe('IPC_CHANNELS', () => {
  it('enthaelt alle V1-Channel-Strings', () => {
    expect(IPC_CHANNELS.VIDEO_OPEN).toBe('video:open')
    expect(IPC_CHANNELS.SCENE_DETECT).toBe('scene:detect')
    expect(IPC_CHANNELS.FRAME_EXTRACT_BATCH).toBe('frame:extractBatch')
    expect(IPC_CHANNELS.PROJECT_SAVE).toBe('project:save')
    expect(IPC_CHANNELS.EXPORT_ZIP).toBe('export:zip')
    expect(IPC_CHANNELS.APP_GET_VERSION).toBe('app:getVersion')
    expect(IPC_CHANNELS.PROXY_GENERATE).toBe('proxy:generate')
  })

  it('enthaelt V2-Channel-Strings', () => {
    expect(IPC_CHANNELS.TRANSCRIPTION_START).toBe('transcription:start')
    expect(IPC_CHANNELS.AI_ANALYZE).toBe('ai:analyze')
    expect(IPC_CHANNELS.CLIP_EXPORT).toBe('clip:export')
    expect(IPC_CHANNELS.API_KEY_SET).toBe('apiKey:set')
    expect(IPC_CHANNELS.ELEVENLABS_TRANSCRIBE).toBe('elevenlabs:transcribe')
  })
})

describe('WINDOW_DEFAULTS', () => {
  it('hat sinnvolle Standardwerte', () => {
    expect(WINDOW_DEFAULTS.width).toBe(1280)
    expect(WINDOW_DEFAULTS.height).toBe(800)
    expect(WINDOW_DEFAULTS.minWidth).toBeGreaterThan(0)
    expect(WINDOW_DEFAULTS.minHeight).toBeGreaterThan(0)
  })
})

describe('DETECTION_DEFAULTS', () => {
  it('hat Threshold-Grenzen', () => {
    expect(DETECTION_DEFAULTS.threshold).toBe(0.3)
    expect(DETECTION_DEFAULTS.minThreshold).toBeLessThan(DETECTION_DEFAULTS.threshold)
    expect(DETECTION_DEFAULTS.maxThreshold).toBeGreaterThan(DETECTION_DEFAULTS.threshold)
  })
})

describe('THUMB_SIZE', () => {
  it('hat 320x180', () => {
    expect(THUMB_SIZE.width).toBe(320)
    expect(THUMB_SIZE.height).toBe(180)
  })
})

describe('SUPPORTED_FORMATS', () => {
  it('enthaelt gaengige Video-Formate', () => {
    expect(SUPPORTED_FORMATS).toContain('.mp4')
    expect(SUPPORTED_FORMATS).toContain('.mov')
    expect(SUPPORTED_FORMATS).toContain('.mkv')
    expect(SUPPORTED_FORMATS).toContain('.mxf')
  })
})

describe('EXPORT_CODECS', () => {
  it('hat ProRes und H264 Presets', () => {
    expect(EXPORT_CODECS.PRORES.name).toContain('ProRes')
    expect(EXPORT_CODECS.PRORES.extension).toBe('.mov')
    expect(EXPORT_CODECS.H264.name).toContain('H.264')
    expect(EXPORT_CODECS.H264.extension).toBe('.mp4')
  })

  it('hat gueltige FFmpeg-Args', () => {
    expect(EXPORT_CODECS.PRORES.args).toContain('-c:v')
    expect(EXPORT_CODECS.H264.args).toContain('-c:v')
  })
})

describe('PROXY_CONFIG', () => {
  it('hat Browser-kompatible Codecs', () => {
    expect(PROXY_CONFIG.BROWSER_COMPATIBLE_CODECS).toContain('h264')
    expect(PROXY_CONFIG.PIX_FMT).toBe('yuv420p')
  })
})

describe('Timer-Konstanten', () => {
  it('Auto-Save ist 5 Minuten', () => {
    expect(AUTO_SAVE_INTERVAL_MS).toBe(5 * 60 * 1000)
  })

  it('Quit-Timeout ist 5 Sekunden', () => {
    expect(QUIT_TIMEOUT_MS).toBe(5000)
  })
})

describe('secondsToTimecode', () => {
  it('konvertiert 0 Sekunden', () => {
    expect(secondsToTimecode(0)).toBe('00:00:00.000')
  })

  it('konvertiert einfache Sekunden', () => {
    expect(secondsToTimecode(65)).toBe('00:01:05.000')
  })

  it('konvertiert Stunden', () => {
    expect(secondsToTimecode(3661.5)).toBe('01:01:01.500')
  })

  it('konvertiert Millisekunden korrekt', () => {
    const result = secondsToTimecode(1.234)
    expect(result).toBe('00:00:01.234')
  })
})
