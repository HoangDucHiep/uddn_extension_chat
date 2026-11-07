import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  backoffFor,
  CONNECTION_BACKOFF_MS,
  nextBackoff,
  probeConnection,
  statusFromOnline,
} from '../src/lib/connectionStatus'

/**
 * Unit test cho `connectionStatus` (NFR-REL-04 — T-M1-19).
 *
 * - Probe health → online / offline / degraded.
 * - Backoff 5s → 15s → 30s.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.15
 */

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('backoffFor', () => {
  it('backoff la 5s → 15s → 30s → giu 30s', () => {
    expect(backoffFor(0)).toBe(5_000)
    expect(backoffFor(1)).toBe(15_000)
    expect(backoffFor(2)).toBe(30_000)
    expect(backoffFor(5)).toBe(30_000)
  })

  it('attempt am → tra gia tri dau', () => {
    expect(backoffFor(-1)).toBe(5_000)
  })
})

describe('nextBackoff', () => {
  it('nextBackoff tang 1 bac', () => {
    expect(nextBackoff(0)).toBe(15_000)
    expect(nextBackoff(1)).toBe(30_000)
  })

  it('chuoi backoff khai bao dung', () => {
    expect(CONNECTION_BACKOFF_MS).toEqual([5_000, 15_000, 30_000])
  })
})

describe('statusFromOnline', () => {
  it('online → connecting, offline → offline', () => {
    expect(statusFromOnline(true)).toBe('connecting')
    expect(statusFromOnline(false)).toBe('offline')
  })
})

describe('probeConnection', () => {
  it('health ok → connected', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await probeConnection()

    expect(result.status).toBe('connected')
  })

  it('health degraded → degraded', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'degraded' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await probeConnection()

    expect(result.status).toBe('degraded')
  })

  it('HTTP loi → offline', async () => {
    fetchMock.mockResolvedValue(new Response('loi', { status: 500 }))

    const result = await probeConnection()

    expect(result.status).toBe('offline')
  })

  it('fetch reject → offline', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))

    const result = await probeConnection()

    expect(result.status).toBe('offline')
  })

  it('probe that bai → tang so lan thu (backoff)', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))

    await probeConnection()
    await probeConnection()

    // Backoff tang danh theo so lan that bai.
    expect(nextBackoff(0)).toBe(15_000)
  })
})
