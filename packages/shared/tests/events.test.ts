import { describe, expect, it } from 'vitest'
import {
  chatEventSchema,
  isChatEvent,
  CHAT_EVENT_TYPES,
} from '../src/events.js'
import { AppError, ERROR_CODES, ERROR_STATUS_MAP } from '../src/errors.js'

describe('events', () => {
  it('co du 10 event type', () => {
    expect(CHAT_EVENT_TYPES).toHaveLength(10)
  })

  it('parse budget event (T-M2-03b)', () => {
    expect(
      isChatEvent({
        type: 'budget',
        state: 'warning',
        spentUsd: 8,
        limitUsd: 10,
        percentUsed: 80,
        period: 'monthly',
      }),
    ).toBe(true)
  })

  it('parse meta event', () => {
    const event = {
      type: 'meta',
      messageId: 'm1',
      conversationId: 'c1',
      provider: 'groq',
      model: 'gpt',
      keySource: 'K1',
      requestId: 'r1',
    }
    expect(isChatEvent(event)).toBe(true)
  })

  it('parse token event', () => {
    expect(isChatEvent({ type: 'token', delta: 'Xin', index: 0 })).toBe(true)
  })

  it('parse citation event', () => {
    expect(
      isChatEvent({ type: 'citation', index: 0, url: 'https://a.b', title: 'T', snippet: 'S' }),
    ).toBe(true)
  })

  it('parse tool_call event', () => {
    expect(isChatEvent({ type: 'tool_call', id: 't1', name: 'read', args: { a: 1 } })).toBe(true)
  })

  it('parse tool_result event', () => {
    expect(
      isChatEvent({ type: 'tool_result', id: 't1', ok: true, output: 'x', durationMs: 12 }),
    ).toBe(true)
  })

  it('parse usage event', () => {
    expect(isChatEvent({ type: 'usage', tokensIn: 10, tokensOut: 20, costUsd: 0.1 })).toBe(true)
  })

  it('parse provider_switch event (T-M2-02)', () => {
    expect(
      isChatEvent({
        type: 'provider_switch',
        from: 'groq',
        to: 'openrouter',
        reason: 'PROVIDER_RATE_LIMITED',
        model: 'google/gemini-2.5-flash',
      }),
    ).toBe(true)
  })

  it('provider_switch event thieu `to` bi tu choi', () => {
    const parsed = chatEventSchema.safeParse({
      type: 'provider_switch',
      from: 'groq',
      reason: 'PROVIDER_ERROR',
    })
    expect(parsed.success).toBe(false)
  })

  it('parse error event', () => {
    expect(
      isChatEvent({ type: 'error', code: 'PROVIDER_ERROR', message: 'x', retryable: true }),
    ).toBe(true)
  })

  it('parse error event co retryAfterSeconds (T-M1-19)', () => {
    expect(
      isChatEvent({
        type: 'error',
        code: 'PROVIDER_RATE_LIMITED',
        message: 'x',
        retryable: true,
        retryAfterSeconds: 42,
      }),
    ).toBe(true)
  })

  it('error event tu choi retryAfterSeconds am', () => {
    const parsed = chatEventSchema.safeParse({
      type: 'error',
      code: 'PROVIDER_RATE_LIMITED',
      message: 'x',
      retryable: true,
      retryAfterSeconds: -1,
    })
    expect(parsed.success).toBe(false)
  })

  it('parse done event', () => {
    expect(isChatEvent({ type: 'done', finishReason: 'stop', messageId: 'm1' })).toBe(true)
  })

  it('tu choi event khong hop le', () => {
    expect(isChatEvent({ type: 'token' })).toBe(false)
    expect(isChatEvent({ type: 'unknown' })).toBe(false)
    expect(isChatEvent(null)).toBe(false)
    expect(isChatEvent('token')).toBe(false)
  })

  it('done chi nhan finishReason hop le', () => {
    const parsed = chatEventSchema.safeParse({
      type: 'done',
      finishReason: 'sai',
      messageId: 'm1',
    })
    expect(parsed.success).toBe(false)
  })
})

describe('errors', () => {
  it('AppError map dung HTTP status', () => {
    const error = new AppError(ERROR_CODES.NOT_FOUND, 'Khong tim thay')
    expect(error.status).toBe(404)
    expect(error.code).toBe('NOT_FOUND')
  })

  it('AppError.toBody() tra error code + message', () => {
    const error = new AppError(ERROR_CODES.VALIDATION_ERROR, 'Sai du lieu')
    expect(error.toBody()).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'Sai du lieu' },
    })
  })

  it('AppError co details thi them vao body', () => {
    const error = new AppError(ERROR_CODES.BAD_REQUEST, 'Sai', { field: 'x' })
    expect(error.toBody().error.details).toEqual({ field: 'x' })
  })

  it('moi error code deu co status', () => {
    for (const code of Object.values(ERROR_CODES)) {
      expect(ERROR_STATUS_MAP[code]).toBeGreaterThanOrEqual(400)
    }
  })
})
