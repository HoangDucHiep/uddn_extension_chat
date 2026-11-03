import { describe, expect, it } from 'vitest'
import { parseSseEvent, mapStatusToCode } from '../src/providers/sse.js'

describe('sse helpers', () => {
  describe('parseSseEvent', () => {
    it('lay data tu 1 block SSE', () => {
      const raw = 'event: token\ndata: {"type":"token","delta":"Xin"}'
      expect(parseSseEvent(raw)).toBe('{"type":"token","delta":"Xin"}')
    })

    it('bo qua comment (heartbeat)', () => {
      const raw = ': ping\ndata: {"a":1}'
      expect(parseSseEvent(raw)).toBe('{"a":1}')
    })

    it('tra undefined khi khong co field data', () => {
      expect(parseSseEvent('event: ping')).toBeUndefined()
    })

    it('gop nhieu dong data thanh mot chuoi', () => {
      const raw = 'data: line1\ndata: line2'
      expect(parseSseEvent(raw)).toBe('line1\nline2')
    })

    it('xu ly CRLF', () => {
      const raw = 'event: token\r\ndata: {"a":1}\r\n'
      expect(parseSseEvent(raw)).toBe('{"a":1}')
    })
  })

  describe('mapStatusToCode', () => {
    it('401 -> INVALID_API_KEY', () => {
      expect(mapStatusToCode(401)).toBe('INVALID_API_KEY')
    })

    it('403 -> INVALID_API_KEY', () => {
      expect(mapStatusToCode(403)).toBe('INVALID_API_KEY')
    })

    it('404 -> MODEL_NOT_FOUND', () => {
      expect(mapStatusToCode(404)).toBe('MODEL_NOT_FOUND')
    })

    it('429 -> PROVIDER_RATE_LIMITED', () => {
      expect(mapStatusToCode(429)).toBe('PROVIDER_RATE_LIMITED')
    })

    it('503 -> PROVIDER_UNAVAILABLE', () => {
      expect(mapStatusToCode(503)).toBe('PROVIDER_UNAVAILABLE')
    })

    it('400 -> PROVIDER_ERROR', () => {
      expect(mapStatusToCode(400)).toBe('PROVIDER_ERROR')
    })
  })
})
