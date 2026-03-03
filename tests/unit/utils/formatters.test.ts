import { describe, it, expect } from 'vitest'
import { formatFileSize } from '@lib/utils/formatters'

describe('formatFileSize', () => {
  it('formatiert 0 Bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('formatiert Bytes unter 1 KB', () => {
    expect(formatFileSize(512)).toBe('512 B')
  })

  it('formatiert exakt 1 KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
  })

  it('formatiert exakt 1 MB', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB')
  })

  it('formatiert exakt 1 GB', () => {
    expect(formatFileSize(1073741824)).toBe('1.0 GB')
  })

  it('formatiert 1.5 MB korrekt', () => {
    expect(formatFileSize(1572864)).toBe('1.5 MB')
  })

  it('formatiert TB-Bereich', () => {
    expect(formatFileSize(1099511627776)).toBe('1.0 TB')
  })

  it('gibt Fallback bei negativen Werten zurück', () => {
    expect(formatFileSize(-100)).toBe('0 B')
  })

  it('gibt Fallback bei NaN zurück', () => {
    expect(formatFileSize(NaN)).toBe('0 B')
  })

  it('gibt Fallback bei Infinity zurück', () => {
    expect(formatFileSize(Infinity)).toBe('0 B')
  })

  it('formatiert 1 Byte korrekt', () => {
    expect(formatFileSize(1)).toBe('1 B')
  })

  it('formatiert Grenzwert 1023 Bytes', () => {
    expect(formatFileSize(1023)).toBe('1023 B')
  })
})
