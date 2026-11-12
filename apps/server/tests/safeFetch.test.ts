import { describe, expect, it } from 'vitest'
import {
  SafeFetchError,
  isBlockedAddress,
  readBuffer,
  readText,
  safeFetch,
} from '../src/lib/safeFetch.js'

/**
 * Unit test cho lop fetch chong SSRF — T-M1-21 / T-M1-22.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.1
 */

describe('isBlockedAddress', () => {
  it('chan loopback', () => {
    expect(isBlockedAddress('127.0.0.1')).toBe(true)
    expect(isBlockedAddress('127.255.255.254')).toBe(true)
  })

  it('chan private range', () => {
    expect(isBlockedAddress('10.0.0.1')).toBe(true)
    expect(isBlockedAddress('172.16.0.1')).toBe(true)
    expect(isBlockedAddress('172.31.255.255')).toBe(true)
    expect(isBlockedAddress('192.168.1.1')).toBe(true)
  })

  it('chan link-local (cloud metadata)', () => {
    expect(isBlockedAddress('169.254.169.254')).toBe(true)
  })

  it('chan CGNAT', () => {
    expect(isBlockedAddress('100.64.0.1')).toBe(true)
    expect(isBlockedAddress('100.127.255.255')).toBe(true)
  })

  it('chan IPv6 noi bo', () => {
    expect(isBlockedAddress('::1')).toBe(true)
    expect(isBlockedAddress('fd00::1')).toBe(true)
    expect(isBlockedAddress('fe80::1')).toBe(true)
    expect(isBlockedAddress('::ffff:127.0.0.1')).toBe(true)
  })

  it('cho phep IP cong khai', () => {
    expect(isBlockedAddress('8.8.8.8')).toBe(false)
    expect(isBlockedAddress('1.1.1.1')).toBe(false)
    expect(isBlockedAddress('172.32.0.1')).toBe(false)
    expect(isBlockedAddress('100.128.0.1')).toBe(false)
    expect(isBlockedAddress('2606:4700:4700::1111')).toBe(false)
  })
})

describe('safeFetch', () => {
  it('tu choi protocol khong http(s)', async () => {
    await expect(safeFetch('file:///C:/secret.txt')).rejects.toBeInstanceOf(SafeFetchError)
    await expect(safeFetch('ftp://example.com/a')).rejects.toBeInstanceOf(SafeFetchError)
  })

  it('tu choi IP noi bo (khong goi mang)', async () => {
    await expect(safeFetch('http://127.0.0.1:8787/api/health')).rejects.toThrow(
      /địa chỉ nội bị chặn|nội bị chặn/i,
    )
    await expect(safeFetch('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
      /nội bị chặn/i,
    )
  })

  it('nem SafeFetchError khi host khong phan giai duoc', async () => {
    await expect(
      safeFetch('http://this-host-does-not-exist-sidekick-test.invalid/a'),
    ).rejects.toBeInstanceOf(SafeFetchError)
  })

  it('chan hostname noi bo (localhost / .local / .internal)', async () => {
    await expect(safeFetch('http://localhost:8787/api/health')).rejects.toThrow(
      /host nội bộ bị chặn/i,
    )
    await expect(safeFetch('http://service.internal/data')).rejects.toThrow(/host nội bộ bị chặn/i)
    await expect(safeFetch('http://printer.local/status')).rejects.toThrow(/host nội bộ bị chặn/i)
  })
})

describe('readText / readBuffer', () => {
  it('doc body text', async () => {
    const response = new Response('Xin chao', { status: 200 })
    const result = {
      url: 'https://example.com',
      status: 200,
      headers: response.headers,
      body: response.body as ReadableStream<Uint8Array>,
    }
    await expect(readText(result)).resolves.toBe('Xin chao')
  })

  it('doc body binary thanh Uint8Array', async () => {
    const payload = new Uint8Array([1, 2, 3, 4])
    const response = new Response(payload, { status: 200 })
    const result = {
      url: 'https://example.com',
      status: 200,
      headers: response.headers,
      body: response.body as ReadableStream<Uint8Array>,
    }
    await expect(readBuffer(result)).resolves.toEqual(payload)
  })
})
