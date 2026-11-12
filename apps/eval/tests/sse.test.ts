import { describe, expect, it } from 'vitest'
import { parseSseBlock, applyEvent } from '../src/sse.js'
import type { ChatStreamResult } from '../src/sse.js'

/**
 * Test SSE client cho eval harness (T-M2-13).
 *
 * AC goc: parse duoc block SSE raw (`event:` + `data:`) · bo qua block
 * hong · khong vong lai khi server gui event la.
 *
 * Luu y: payload trong test phai khop **schema that** cua `chatEventSchema`
 * (`packages/shared/src/events.ts`) — vi du `token` can `index`, `done` can
 * `messageId` → neu thieu, block bi bo qua ( dung behavior mong doi).
 *
 * Docs: docs/EVAL_PLAN.md §6.1
 */

describe('parseSseBlock', () => {
  it('parse event token', () => {
    const event = parseSseBlock('event: token\ndata: {"type":"token","delta":"Xin","index":0}')
    expect(event?.type).toBe('token')
  })

  it('parse event done', () => {
    const event = parseSseBlock(
      'event: done\ndata: {"type":"done","finishReason":"stop","messageId":"m-1"}',
    )
    expect(event?.type).toBe('done')
  })

  it('bo qua comment (dong bat dau dau hai cham)', () => {
    const event = parseSseBlock(
      ': ping\ndata: {"type":"done","finishReason":"stop","messageId":"m-1"}',
    )
    expect(event?.type).toBe('done')
  })

  it('bo qua block khong co data', () => {
    expect(parseSseBlock('event: token')).toBeUndefined()
  })

  it('bo qua block JSON hong', () => {
    expect(parseSseBlock('data: {not json}')).toBeUndefined()
  })

  it('bo qua event khong khop schema (server them event moi)', () => {
    expect(parseSseBlock('data: {"type":"unknown_future_event","x":1}')).toBeUndefined()
  })

  it('bo qua event thieu field bat buoc', () => {
    // `token` can `index` → thieu → bo qua.
    expect(parseSseBlock('data: {"type":"token","delta":"a"}')).toBeUndefined()
  })

  it('xu ly data nhieu dong', () => {
    const event = parseSseBlock('data: {"type":"token",\ndata: "delta":"a"}')
    // JSON 2 dong khong hop le → bo qua.
    expect(event).toBeUndefined()
  })

  it('parse event usage', () => {
    const event = parseSseBlock(
      'data: {"type":"usage","tokensIn":100,"tokensOut":50,"costUsd":0.001}',
    )
    expect(event?.type).toBe('usage')
  })

  it('parse event citation', () => {
    const event = parseSseBlock(
      'data: {"type":"citation","index":1,"url":"https://example.com","title":"T","snippet":"s"}',
    )
    expect(event?.type).toBe('citation')
  })

  it('parse event error', () => {
    const event = parseSseBlock(
      'data: {"type":"error","code":"PROVIDER_ERROR","message":"x","retryable":true}',
    )
    expect(event?.type).toBe('error')
  })
})

describe('applyEvent — provider_switch', () => {
  /**
   * Server phat `provider_switch` khi fallback sang provider du phong
   * (FR-PROVIDER-04) → provider trong event `meta` **khong** con la provider
   * that su tra loi → harness phai cap nhat de metric "theo provider" dung.
   */
  it('cap nhat provider + model khi fallback', () => {
    const result: ChatStreamResult = { answer: '', latencyMs: 0, citations: [], fallbackChain: [] }

    const meta = parseSseBlock(
      'data: {"type":"meta","messageId":"m-1","conversationId":"c-1","provider":"gemini","model":"gemini-2.5-flash","keySource":"K1","requestId":"r-1","turnId":"t-1"}',
    )
    expect(meta).toBeDefined()
    if (meta !== undefined) applyEvent(meta, result)

    expect(result.provider).toBe('gemini')
    expect(result.fallbackChain).toEqual([])

    const switched = parseSseBlock(
      'data: {"type":"provider_switch","from":"gemini","to":"openrouter","reason":"RATE_LIMIT","model":"google/gemini-2.5-flash"}',
    )
    expect(switched).toBeDefined()
    if (switched !== undefined) applyEvent(switched, result)

    expect(result.provider).toBe('openrouter')
    expect(result.model).toBe('google/gemini-2.5-flash')
    expect(result.fallbackChain).toEqual(['openrouter'])
  })

  it('ghi nhieu lan fallback theo thu tu', () => {
    const result: ChatStreamResult = { answer: '', latencyMs: 0, citations: [], fallbackChain: [] }

    for (const block of [
      'data: {"type":"provider_switch","from":"gemini","to":"groq","reason":"RATE_LIMIT"}',
      'data: {"type":"provider_switch","from":"groq","to":"openrouter","reason":"CREDITS"}',
    ]) {
      const event = parseSseBlock(block)
      if (event !== undefined) applyEvent(event, result)
    }

    expect(result.fallbackChain).toEqual(['groq', 'openrouter'])
    expect(result.provider).toBe('openrouter')
  })
})
