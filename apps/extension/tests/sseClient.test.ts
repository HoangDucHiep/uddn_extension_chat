import { describe, it, expect } from 'vitest'
import { parseSseBlock } from '../src/lib/sseClient'
import type { ChatEvent } from '@sidekick/shared'

/**
 * Unit test cho SSE parser cua extension.
 * Docs: docs/SYSTEM_DESIGN.md §4.1 (SSE 8 event)
 */

const metaEvent: ChatEvent = {
  type: 'meta',
  messageId: 'msg-1',
  conversationId: 'conv-1',
  provider: 'groq',
  model: 'openai/gpt-oss-120b',
  keySource: 'K1',
  requestId: 'req-1',
}

const tokenEvent: ChatEvent = { type: 'token', delta: 'Xin', index: 0 }

describe('parseSseBlock', () => {
  it('parse event `data:` hop le', () => {
    const raw = `data: ${JSON.stringify(metaEvent)}`
    expect(parseSseBlock(raw)).toEqual(metaEvent)
  })

  it('bo qua comment heartbeat', () => {
    const raw = `: ping\ndata: ${JSON.stringify(metaEvent)}`
    expect(parseSseBlock(raw)).toEqual(metaEvent)
  })

  it('tra undefined khi khong co dong `data:`', () => {
    expect(parseSseBlock('event: token')).toBeUndefined()
    expect(parseSseBlock('')).toBeUndefined()
  })

  it('tra undefined khi JSON khong hop le', () => {
    expect(parseSseBlock('data: {khong-hop-le')).toBeUndefined()
  })

  it('tra undefined khi payload khong phai ChatEvent hop le', () => {
    expect(parseSseBlock('data: {"type":"unknown_event"}')).toBeUndefined()
    expect(parseSseBlock('data: {"foo":"bar"}')).toBeUndefined()
  })

  it('tra undefined khi event thieu field bat buoc', () => {
    // Thieu `keySource` → schema fail → undefined.
    expect(parseSseBlock('data: {"type":"meta","conversationId":"c"}')).toBeUndefined()
  })

  it('parse token event', () => {
    expect(parseSseBlock(`data: ${JSON.stringify(tokenEvent)}`)).toEqual(tokenEvent)
  })
})
