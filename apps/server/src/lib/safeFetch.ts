/**
 * Fetch an toan cho URL ben ngoai (chong SSRF).
 *
 * BFF nhan `url` tu client de trich xuat PDF / transcript → neu fetch truc tiep
 * se bi dung de quet mang noi bo (localhost, metadata endpoint cloud, Docker
 * network...). Lop nay:
 *  1. Chi cho `http:` / `https:`.
 *  2. Resolve DNS va chan IP noi bo / private / link-local / CGNAT.
 *  3. Tu di theo redirect ( toi da 3 hop) va kiem tra lai moi hop.
 *  4. Gioi han kich thuoc response + timeout.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.1, T-M1-21 / T-M1-22
 */

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { ERROR_CODES } from '@sidekick/shared'

/** Loi rieng cua lop fetch — map ve error code chuan o `errors.ts`. */
export class SafeFetchError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.name = 'SafeFetchError'
    this.code = code
    this.status = status
  }
}

export interface SafeFetchOptions {
  /** So hop redirect toi da cho phep. */
  maxRedirects?: number | undefined
  /** Timeout moi request (ms). */
  timeoutMs?: number | undefined
  /** Gioi han kich thuoc response (byte). */
  maxBytes?: number | undefined
  /** Header gui them (vd `User-Agent`). */
  headers?: Record<string, string> | undefined
  /** HTTP method (mac dinh `GET`). */
  method?: 'GET' | 'POST' | undefined
  /** Body cua request (chi dung voi `POST`). */
  body?: string | undefined
  /** Signal de huy. */
  signal?: AbortSignal | undefined
}

export interface SafeFetchResult {
  url: string
  status: number
  headers: Headers
  /** Body dang doc (chua gioi han kich thuoc). */
  body: ReadableStream<Uint8Array>
}

const DEFAULT_MAX_REDIRECTS = 3
const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_BYTES = 20_000_000

/** Cac dai IP bi chan (dien tich private / loopback / link-local / CGNAT). */
const BLOCKED_IPV4_RANGES: ReadonlyArray<{ cidr: string; prefix: number }> = [
  { cidr: '127.0.0.0', prefix: 8 }, // loopback
  { cidr: '10.0.0.0', prefix: 8 }, // private
  { cidr: '172.16.0.0', prefix: 12 }, // private
  { cidr: '192.168.0.0', prefix: 16 }, // private
  { cidr: '169.254.0.0', prefix: 16 }, // link-local (cloud metadata)
  { cidr: '100.64.0.0', prefix: 10 }, // CGNAT
  { cidr: '0.0.0.0', prefix: 8 }, // "this network"
]

/** IPv6 bi chan — loopback, unique-local, link-local. */
const BLOCKED_IPV6_PREFIXES = ['::1', 'fc', 'fd', 'fe80', '::ffff:127.']

/**
 * Kiem tra mot dia chi IP co bi chan hay khong.
 *
 * @param address - Dia chi IP dang chuoi.
 */
export function isBlockedAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) {
    return BLOCKED_IPV4_RANGES.some((range) => isInCidr(address, range.cidr, range.prefix))
  }
  if (version === 6) {
    const normalized = address.toLowerCase()
    // IPv4-mapped IPv6 (::ffff:127.0.0.1) → chan theo quy tac IPv4.
    if (normalized.startsWith('::ffff:')) {
      const mapped = normalized.slice('::ffff:'.length)
      return isIP(mapped) === 4 ? isBlockedAddress(mapped) : true
    }
    return BLOCKED_IPV6_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  }
  return true
}

/** Kiem tra IP (IPv4) co nam trong CIDR hay khong. */
function isInCidr(address: string, cidr: string, prefix: number): boolean {
  const addressBits = toInt32(address)
  const cidrBits = toInt32(cidr)
  if (addressBits === null || cidrBits === null) return true

  // So san ca 32 bit theo prefix; dung `>>> 0` de tranh bitwise tren signed int.
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  return ((addressBits & mask) >>> 0) === ((cidrBits & mask) >>> 0)
}

/** Chuyen IPv4 thanh so nguyen 32-bit unsigned (hoac `null` neu khong hop le). */
function toInt32(address: string): number | null {
  const parts = address.split('.')
  if (parts.length !== 4) return null

  let value = 0
  for (const part of parts) {
    const octet = Number.parseInt(part, 10)
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null
    value = value * 256 + octet
  }
  return value >>> 0
}

/**
 * Resolve host va kiem tra toan bo dia chi IP tra ve.
 *
 * Tra `undefined` khi host khong phai IP literal va khong resolve duoc
 * (de caller bao loi mang).
 */
export async function assertPublicHost(hostname: string): Promise<void> {
  const literal = hostname.replace(/^\[|\]$/g, '')

  if (isIP(literal) !== 0) {
    if (isBlockedAddress(literal)) {
      throw new SafeFetchError(
        ERROR_CODES.CONTEXT_EXTRACT_FAILED,
        `Dia chi IP noi bi chan: ${literal}`,
        400,
      )
    }
    return
  }

  let addresses: Array<{ address: string }>
  try {
    addresses = await lookup(literal, { all: true })
  } catch {
    throw new SafeFetchError(
      ERROR_CODES.CONTEXT_EXTRACT_FAILED,
      `Khong phan giai duoc host: ${hostname}`,
      502,
    )
  }

  if (addresses.length === 0) {
    throw new SafeFetchError(
      ERROR_CODES.CONTEXT_EXTRACT_FAILED,
      `Khong phan giai duoc host: ${hostname}`,
      502,
    )
  }

  const blocked = addresses.find((entry) => isBlockedAddress(entry.address))
  if (blocked !== undefined) {
    throw new SafeFetchError(
      ERROR_CODES.CONTEXT_EXTRACT_FAILED,
      `Host tro toi dia chi noi bi chan: ${hostname} (${blocked.address})`,
      400,
    )
  }
}

/**
 * Fetch URL ben ngoai co bao ve SSRF.
 *
 * @param url - URL dich.
 * @param options - Tuy chon fetch.
 */
export async function safeFetch(url: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES

  let currentUrl = url
  // Redirect theo chuan HTTP: 301/302/303 doi method sang GET va bo body.
  let method = options.method ?? 'GET'
  let body = options.body

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const parsed = new URL(currentUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new SafeFetchError(
        ERROR_CODES.CONTEXT_EXTRACT_FAILED,
        `Protocol khong ho tro: ${parsed.protocol}`,
        400,
      )
    }

    await assertPublicHost(parsed.hostname)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const onExternalAbort = () => controller.abort()
    options.signal?.addEventListener('abort', onExternalAbort, { once: true })

    let response: Response
    try {
      response = await fetch(currentUrl, {
        method,
        redirect: 'manual',
        signal: controller.signal,
        ...(options.headers !== undefined ? { headers: options.headers } : {}),
        ...(body !== undefined ? { body } : {}),
      })
    } catch (error) {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onExternalAbort)
      const isAbort = error instanceof Error && error.name === 'AbortError'
      throw new SafeFetchError(
        isAbort ? ERROR_CODES.TIMEOUT : ERROR_CODES.CONTEXT_EXTRACT_FAILED,
        isAbort ? `Timeout sau ${timeoutMs}ms` : `Fetch that bai: ${String(error)}`,
        isAbort ? 504 : 502,
      )
    }

    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onExternalAbort)

    // Redirect → kiem tra lai host cua hop moi truoc khi fetch tiep.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (location === null) {
        throw new SafeFetchError(
          ERROR_CODES.CONTEXT_EXTRACT_FAILED,
          'Redirect khong co Location header',
          502,
        )
      }
      currentUrl = new URL(location, currentUrl).toString()
      if (response.status === 301 || response.status === 302 || response.status === 303) {
        method = 'GET'
        body = undefined
      }
      continue
    }

    if (!response.ok) {
      throw new SafeFetchError(
        ERROR_CODES.CONTEXT_EXTRACT_FAILED,
        `HTTP ${response.status} khi tai ${currentUrl}`,
        502,
      )
    }

    // Chan response vo han qua `Content-Length` truoc khi doc body.
    const contentLength = Number.parseInt(response.headers.get('content-length') ?? '', 10)
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new SafeFetchError(
        ERROR_CODES.PAYLOAD_TOO_LARGE,
        `Response vuot gioi han ${maxBytes} byte`,
        413,
      )
    }

    return {
      url: currentUrl,
      status: response.status,
      headers: response.headers,
      body: limitStream(response.body, maxBytes),
    }
  }

  throw new SafeFetchError(
    ERROR_CODES.CONTEXT_EXTRACT_FAILED,
    `Vuot qua so hop redirect cho phep (${maxRedirects})`,
    502,
  )
}

/**
 * Boc body stream voi gioi han kich thuoc.
 *
 * Neu stream vuot gioi han → stream bi error, caller nhan `SafeFetchError`.
 */
function limitStream(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): ReadableStream<Uint8Array> {
  if (stream === null) {
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close()
      },
    })
  }

  let received = 0
  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength
        if (received > maxBytes) {
          controller.error(
            new SafeFetchError(
              ERROR_CODES.PAYLOAD_TOO_LARGE,
              `Response vuot gioi han ${maxBytes} byte`,
              413,
            ),
          )
          return
        }
        controller.enqueue(chunk)
      },
    }),
  )
}

/**
 * Doc toan bo body thanh string (gioi han da dat trong `safeFetch`).
 *
 * @param result - Ket qua `safeFetch`.
 */
export async function readText(result: SafeFetchResult): Promise<string> {
  const decoder = new TextDecoder('utf-8')
  const reader = result.body.getReader()
  const chunks: string[] = []

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value !== undefined) chunks.push(decoder.decode(value, { stream: true }))
    }
  } catch (error) {
    if (error instanceof SafeFetchError) throw error
    throw new SafeFetchError(
      ERROR_CODES.CONTEXT_EXTRACT_FAILED,
      `Doc body that bai: ${String(error)}`,
      502,
    )
  }

  chunks.push(decoder.decode())
  return chunks.join('')
}

/**
 * Doc toan bo body thanh `Buffer` (dung cho PDF nhi phan).
 *
 * @param result - Ket qua `safeFetch`.
 */
export async function readBuffer(result: SafeFetchResult): Promise<Uint8Array> {
  const reader = result.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value !== undefined) {
        total += value.byteLength
        chunks.push(value)
      }
    }
  } catch (error) {
    if (error instanceof SafeFetchError) throw error
    throw new SafeFetchError(
      ERROR_CODES.CONTEXT_EXTRACT_FAILED,
      `Doc body that bai: ${String(error)}`,
      502,
    )
  }

  const output = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output
}
