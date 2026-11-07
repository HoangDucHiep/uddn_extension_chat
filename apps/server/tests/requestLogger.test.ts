import { describe, expect, it, vi } from 'vitest'
import type { NextFunction, Request, Response } from 'express'
import {
  createRequestLogger,
  formatHttpLogEntry,
  type HttpLogEntry,
} from '../src/middleware/requestLogger.js'
import {
  createRequestIdMiddleware,
  isValidRequestId,
  readRequestId,
  REQUEST_ID_HEADER,
} from '../src/middleware/requestId.js'

/**
 * Unit test cho request-id + JSON request logger (T-M1-14).
 *
 * AC: "Logging co cau truc (JSON) voi request-id xuyen suot client → BFF →
 * provider" + "khong log secret / body".
 *
 * Docs: docs/SYSTEM_DESIGN.md §6, §7.16
 */

/** Request gia lap voi header cho truoc. */
function makeRequest(headers: Record<string, string> = {}): Request {
  return { headers, method: 'GET', originalUrl: '/api/health' } as unknown as Request
}

/** Response gia lap — giu cac listener de kiem tra `finish`. */
function makeResponse(): {
  res: Response
  statusCode: number
  emit: () => void
} {
  const listeners: Array<() => void> = []
  const res = {
    statusCode: 200,
    on(event: string, listener: () => void) {
      if (event === 'finish') listeners.push(listener)
      return res
    },
    setHeader: vi.fn(),
    getHeader: vi.fn(),
  } as unknown as Response

  return {
    res,
    get statusCode() {
      return res.statusCode
    },
    emit: () => {
      for (const listener of listeners) listener()
    },
  }
}

describe('isValidRequestId', () => {
  it('uuid hop le', () => {
    expect(isValidRequestId('a1b2c3d4-0000-4000-8000-1234567890ab')).toBe(true)
  })

  it('chuoi rong → khong hop le', () => {
    expect(isValidRequestId('')).toBe(false)
  })

  it('qua 200 ky tu → khong hop le', () => {
    expect(isValidRequestId('a'.repeat(201))).toBe(false)
  })

  it('dung 200 ky tu → hop le', () => {
    expect(isValidRequestId('a'.repeat(200))).toBe(true)
  })

  it('ky tu la (newline) → khong hop le (log injection)', () => {
    expect(isValidRequestId('abc\ndef')).toBe(false)
  })

  it('ky tu dac biet → khong hop le', () => {
    expect(isValidRequestId('abc def')).toBe(false)
    expect(isValidRequestId('abc<script>')).toBe(false)
  })

  it('ky tu an toan (.-_:/ ) → hop le', () => {
    expect(isValidRequestId('req-123_abc.def:ghi/hien')).toBe(true)
  })
})

describe('readRequestId', () => {
  it('doc header hop le', () => {
    expect(readRequestId(makeRequest({ [REQUEST_ID_HEADER]: 'req-abc' }))).toBe('req-abc')
  })

  it('khong co header → undefined', () => {
    expect(readRequestId(makeRequest())).toBeUndefined()
  })

  it('header khong hop le → undefined', () => {
    expect(readRequestId(makeRequest({ [REQUEST_ID_HEADER]: 'a b' }))).toBeUndefined()
  })

  it('header la array → undefined', () => {
    const req = { headers: { [REQUEST_ID_HEADER]: ['a', 'b'] } } as unknown as Request
    expect(readRequestId(req)).toBeUndefined()
  })
})

describe('createRequestIdMiddleware', () => {
  it('dung id tu header', () => {
    const middleware = createRequestIdMiddleware()
    const req = makeRequest({ [REQUEST_ID_HEADER]: 'req-from-client' })
    const next = vi.fn()

    middleware(req, makeResponse().res, next as NextFunction)

    expect(req.sidekickRequestId).toBe('req-from-client')
    expect(next).toHaveBeenCalled()
  })

  it('khong co header → sinh id moi (uuid)', () => {
    const middleware = createRequestIdMiddleware()
    const req = makeRequest()

    middleware(req, makeResponse().res, vi.fn() as NextFunction)

    expect(req.sidekickRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('header khong hop le → sinh id moi', () => {
    const middleware = createRequestIdMiddleware()
    const req = makeRequest({ [REQUEST_ID_HEADER]: 'a b c' })

    middleware(req, makeResponse().res, vi.fn() as NextFunction)

    expect(req.sidekickRequestId).not.toBe('a b c')
  })

  it('echo header `X-Request-Id` tren response', () => {
    const middleware = createRequestIdMiddleware()
    const req = makeRequest({ [REQUEST_ID_HEADER]: 'req-echo' })
    const { res } = makeResponse()

    middleware(req, res, vi.fn() as NextFunction)

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'req-echo')
  })
})

describe('formatHttpLogEntry', () => {
  it('la 1 dong JSON hop le', () => {
    const entry: HttpLogEntry = {
      ts: '2026-01-01T00:00:00.000Z',
      level: 'info',
      event: 'http_request',
      requestId: 'req-1',
      method: 'GET',
      path: '/api/health',
      status: 200,
      durationMs: 12,
    }

    const line = formatHttpLogEntry(entry)

    expect(line).not.toContain('\n')
    expect(JSON.parse(line)).toEqual(entry)
  })
})

describe('createRequestLogger', () => {
  it('ghi 1 dong JSON moi khi response xong', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const logger = createRequestLogger('info')
    const req = makeRequest()
    req.sidekickRequestId = 'req-log-1'
    const { res, emit } = makeResponse()

    logger(req, res, vi.fn() as NextFunction)
    emit()

    expect(logSpy).toHaveBeenCalledTimes(1)
    const line = String(logSpy.mock.calls[0]?.[0])
    const parsed = JSON.parse(line) as HttpLogEntry
    expect(parsed.event).toBe('http_request')
    expect(parsed.requestId).toBe('req-log-1')
    expect(parsed.method).toBe('GET')
    expect(parsed.path).toBe('/api/health')
    expect(parsed.status).toBe(200)
    expect(parsed.durationMs).toBeGreaterThanOrEqual(0)
    expect(parsed.level).toBe('info')
    expect(typeof parsed.ts).toBe('string')

    logSpy.mockRestore()
  })

  it('KHONG log body / secret', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const logger = createRequestLogger('info')
    const req = makeRequest()
    req.sidekickRequestId = 'req-log-2'
    // Request co body chua prompt + api key.
    ;(req as unknown as { body?: unknown }).body = {
      messages: [{ content: 'NOI DUNG NHAY CAM' }],
      apiKey: 'sk-secret-123',
    }
    const { res, emit } = makeResponse()

    logger(req, res, vi.fn() as NextFunction)
    emit()

    const line = String(logSpy.mock.calls[0]?.[0])
    expect(line).not.toContain('NOI DUNG NHAY CAM')
    expect(line).not.toContain('sk-secret-123')
    expect(line).not.toContain('body')

    logSpy.mockRestore()
  })

  it('khong co request-id → ghi "unknown"', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const logger = createRequestLogger('info')
    const req = makeRequest()
    const { res, emit } = makeResponse()

    logger(req, res, vi.fn() as NextFunction)
    emit()

    const parsed = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as HttpLogEntry
    expect(parsed.requestId).toBe('unknown')

    logSpy.mockRestore()
  })

  it('level `error` → suppress log `info` (chi ghi muc >= threshold)', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const logger = createRequestLogger('error')
    const req = makeRequest()
    req.sidekickRequestId = 'req-log-3'
    const { res, emit } = makeResponse()

    logger(req, res, vi.fn() as NextFunction)
    emit()

    // Log 1 request la muc `info` → bi suppress khi threshold la `error`.
    expect(logSpy).not.toHaveBeenCalled()

    logSpy.mockRestore()
  })

  it('level `debug` → van ghi', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const logger = createRequestLogger('debug')
    const req = makeRequest()
    req.sidekickRequestId = 'req-log-4'
    const { res, emit } = makeResponse()

    logger(req, res, vi.fn() as NextFunction)
    emit()

    expect(logSpy).toHaveBeenCalledTimes(1)

    logSpy.mockRestore()
  })
})
