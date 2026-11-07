import { describe, expect, it } from 'vitest'
import {
  AUTO_RETRY_BACKOFF_MS,
  classifyChatError,
  defaultRetryAfterSeconds,
  isRetryableKind,
  shouldAutoRetry,
} from '../src/chatErrors.js'
import { ERROR_CODES } from '../src/errors.js'

/**
 * Unit test cho taxonomy loi chat (FR-CHAT-14 / NFR-REL-02 — T-M1-19).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.15
 */

describe('classifyChatError', () => {
  it('loi xac thuc → auth', () => {
    expect(classifyChatError(ERROR_CODES.INVALID_API_KEY)).toBe('auth')
    expect(classifyChatError(ERROR_CODES.PROVIDER_KEY_INVALID)).toBe('auth')
    expect(classifyChatError(ERROR_CODES.MISSING_API_KEY)).toBe('auth')
    expect(classifyChatError(ERROR_CODES.UNAUTHORIZED)).toBe('auth')
    expect(classifyChatError(ERROR_CODES.FORBIDDEN)).toBe('auth')
  })

  it('loi gioi han tan so → rate-limit', () => {
    expect(classifyChatError(ERROR_CODES.PROVIDER_RATE_LIMITED)).toBe('rate-limit')
    expect(classifyChatError(ERROR_CODES.RATE_LIMITED)).toBe('rate-limit')
    expect(classifyChatError(ERROR_CODES.PROVIDER_QUOTA_EXCEEDED)).toBe('rate-limit')
  })

  it('loi mang → network', () => {
    expect(classifyChatError(ERROR_CODES.SERVICE_UNAVAILABLE)).toBe('network')
    expect(classifyChatError(ERROR_CODES.PROVIDER_UNAVAILABLE)).toBe('network')
    expect(classifyChatError(ERROR_CODES.TIMEOUT)).toBe('network')
  })

  it('loi 5xx → server', () => {
    expect(classifyChatError(ERROR_CODES.INTERNAL_ERROR)).toBe('server')
    expect(classifyChatError(ERROR_CODES.DB_ERROR)).toBe('server')
  })

  it('loi provider → provider', () => {
    expect(classifyChatError(ERROR_CODES.PROVIDER_ERROR)).toBe('provider')
    expect(classifyChatError(ERROR_CODES.MODEL_NOT_FOUND)).toBe('provider')
  })

  it('code la → unknown', () => {
    expect(classifyChatError('KHONG_CO_CODE_NAY')).toBe('unknown')
    expect(classifyChatError('')).toBe('unknown')
  })
})

describe('isRetryableKind', () => {
  it('auth khong retry duoc (NFR-REL-02)', () => {
    expect(isRetryableKind('auth')).toBe(false)
  })

  it('cac nhom khac retry duoc', () => {
    expect(isRetryableKind('network')).toBe(true)
    expect(isRetryableKind('server')).toBe(true)
    expect(isRetryableKind('rate-limit')).toBe(true)
    expect(isRetryableKind('provider')).toBe(true)
    expect(isRetryableKind('unknown')).toBe(true)
  })
})

describe('shouldAutoRetry', () => {
  it('chi loi tam thoi moi tu dong retry', () => {
    expect(shouldAutoRetry('network')).toBe(true)
    expect(shouldAutoRetry('server')).toBe(true)
    expect(shouldAutoRetry('unknown')).toBe(true)
  })

  it('auth / rate-limit / provider khong tu dong retry', () => {
    expect(shouldAutoRetry('auth')).toBe(false)
    expect(shouldAutoRetry('rate-limit')).toBe(false)
    expect(shouldAutoRetry('provider')).toBe(false)
  })
})

describe('defaultRetryAfterSeconds', () => {
  it('rate-limit → 60 giay', () => {
    expect(defaultRetryAfterSeconds('rate-limit')).toBe(60)
  })

  it('nhom khac → undefined', () => {
    expect(defaultRetryAfterSeconds('network')).toBeUndefined()
    expect(defaultRetryAfterSeconds('auth')).toBeUndefined()
    expect(defaultRetryAfterSeconds('server')).toBeUndefined()
  })
})

describe('AUTO_RETRY_BACKOFF_MS', () => {
  it('backoff la 800ms (NFR-REL-02 — retry 1 lan)', () => {
    expect(AUTO_RETRY_BACKOFF_MS).toBe(800)
  })
})
