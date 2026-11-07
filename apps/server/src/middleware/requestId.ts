/**
 * Request-id — dinh danh 1 request xuyen suot client → BFF → provider.
 *
 * NFR-MAINT-04: "Logging co cau truc (JSON) voi request-id xuyen suot
 * client → BFF → provider".
 *
 * Quy tac:
 *  1. Client gui `X-Request-Id` → dung id do (cho phep ghep log cua BFF
 *     voi log cua provider).
 *  2. Khong gui hoac gui id **khong hop le** → server sinh `randomUUID()`.
 *  3. Id luon duoc gan vao `req.sidekickRequestId` + echo ngan lai response.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.16 (T-M1-14)
 */

import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'

/** Header mang request-id (client → BFF). */
export const REQUEST_ID_HEADER = 'x-request-id'

/** Do dai toi da cua request-id (ky tu). */
export const MAX_REQUEST_ID_LENGTH = 200

/**
 * Request-id hop le: chi chu, chu so, `-`, `_`, `.`, `:` va `/`.
 *
 * Id duoc ghi vao log (JSON) → cho phep ky tu lap lai de tranh **log
 * injection** (newline trong id se pha JSON dong).
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:/-]+$/

/**
 * Kiem tra request-id co hop le de dung khong.
 *
 * @param value - Gia tri header thô.
 * @returns `true` neu id an toan de ghi vao log.
 */
export function isValidRequestId(value: string): boolean {
  if (value.length === 0 || value.length > MAX_REQUEST_ID_LENGTH) return false
  return SAFE_REQUEST_ID.test(value)
}

/**
 * Lay request-id tu request (neu header hop le).
 *
 * @param req - Request cua Express.
 * @returns Request-id hop le, hoac `undefined`.
 */
export function readRequestId(req: { headers: Record<string, unknown> }): string | undefined {
  const header = req.headers[REQUEST_ID_HEADER]
  if (typeof header !== 'string') return undefined
  if (!isValidRequestId(header)) return undefined
  return header
}

/**
 * Middleware gan request-id cho moi request.
 *
 * Response luon co header `X-Request-Id` → client doc duoc id chinh thuc
 * cua server (server la nguon su that, client id chi la de xuat).
 */
export function createRequestIdMiddleware(): RequestHandler {
  return (req, res, next) => {
    const requestId = readRequestId(req) ?? randomUUID()

    req.sidekickRequestId = requestId
    res.setHeader('X-Request-Id', requestId)

    next()
  }
}
