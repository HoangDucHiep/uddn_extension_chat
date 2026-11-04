import { describe, it, expect, vi } from 'vitest'
import { createOriginGuard, createCorsOptions } from '../src/middleware/origin.js'
import type { Request, Response, NextFunction } from 'express'

/**
 * Unit test cho origin guard + CORS.
 * Docs: docs/SYSTEM_DESIGN.md Â§6.2
 */

/** Tao request gia lap voi Origin cho truoc. */
function makeRequest(origin?: string): Request {
  return {
    headers: origin === undefined ? {} : { origin },
  } as unknown as Request
}

/** Tao response gia lap, ghi lai status va body. */
function makeResponse(): {
  res: Response
  statusCode: () => number
  body: () => unknown
} {
  let code = 200
  let payload: unknown = undefined

  const res = {
    status(value: number) {
      code = value
      return res
    },
    json(value: unknown) {
      payload = value
      return res
    },
  } as unknown as Response

  return {
    res,
    statusCode: () => code,
    body: () => payload,
  }
}

describe('createOriginGuard', () => {
  const guard = createOriginGuard([
    'http://localhost:5173',
    'chrome-extension://*',
  ])

  it('cho qua request khong co Origin (curl, server-to-server)', () => {
    const next = vi.fn()
    guard(makeRequest(), makeResponse().res, next as NextFunction)
    expect(next).toHaveBeenCalled()
  })

  it('cho qua origin dung exact', () => {
    const next = vi.fn()
    guard(makeRequest('http://localhost:5173'), makeResponse().res, next as NextFunction)
    expect(next).toHaveBeenCalled()
  })

  it('cho qua moi id extension voi wildcard theo scheme', () => {
    const next = vi.fn()
    guard(
      makeRequest('chrome-extension://abcdefghijklmnopabcdefghijklmnop'),
      makeResponse().res,
      next as NextFunction,
    )
    expect(next).toHaveBeenCalled()
  })

  it('chan origin la la', () => {
    const next = vi.fn()
    const { res, statusCode } = makeResponse()
    guard(makeRequest('http://evil.example'), res, next as NextFunction)
    expect(next).not.toHaveBeenCalled()
    expect(statusCode()).toBe(403)
  })

  it('khong cho phep web page gia dang scheme khac', () => {
    const next = vi.fn()
    const { res, statusCode } = makeResponse()
    guard(makeRequest('moz-extension://abc'), res, next as NextFunction)
    expect(next).not.toHaveBeenCalled()
    expect(statusCode()).toBe(403)
  })
})

describe('createCorsOptions', () => {
  const options = createCorsOptions(['http://localhost:5173', 'chrome-extension://*'])

  it('cho phep origin da khai bao', () => {
    const callback = vi.fn()
    const origin = options.origin as (o: string | undefined, cb: unknown) => void
    origin('http://localhost:5173', callback)
    expect(callback).toHaveBeenCalledWith(null, true)
  })

  it('cho phep extension id bat ky', () => {
    const callback = vi.fn()
    const origin = options.origin as (o: string | undefined, cb: unknown) => void
    origin('chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', callback)
    expect(callback).toHaveBeenCalledWith(null, true)
  })

  it('tu choi origin la la', () => {
    const callback = vi.fn()
    const origin = options.origin as (o: string | undefined, cb: unknown) => void
    origin('http://evil.example', callback)
    expect(callback).toHaveBeenCalledWith(null, false)
  })

  it('cho qua request khong co Origin', () => {
    const callback = vi.fn()
    const origin = options.origin as (o: string | undefined, cb: unknown) => void
    origin(undefined, callback)
    expect(callback).toHaveBeenCalledWith(null, true)
  })
})
