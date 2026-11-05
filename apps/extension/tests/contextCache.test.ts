import { describe, expect, it, beforeEach } from 'vitest'
import { CONTEXT_CACHE_MAX_ENTRIES, CONTEXT_CACHE_TTL_MS, contextHashKey } from '@sidekick/shared'
import {
  clearContextCache,
  hasContentChanged,
  readCachedContext,
  toCacheEntry,
  writeCachedContext,
} from '../src/lib/contextCache.js'

/**
 * Unit test cho cache context theo URL (T-M1-06).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.5
 */

const NOW = 1_700_000_000_000

beforeEach(async () => {
  await clearContextCache()
})

describe('writeCachedContext + readCachedContext', () => {
  it('round-trip: ghi xong doc lai duoc', async () => {
    await writeCachedContext({
      url: 'https://example.com/bai-viet',
      title: 'Bai viet',
      text: 'Noi dung chinh.',
      excerpt: 'Noi dung chinh.',
      sourceKind: 'html',
      contentHash: 'hash-1',
      capturedAt: NOW,
    })

    const cached = await readCachedContext('https://example.com/bai-viet', NOW)

    expect(cached?.text).toBe('Noi dung chinh.')
    expect(cached?.title).toBe('Bai viet')
    expect(cached?.sourceKind).toBe('html')
    expect(cached?.contentHash).toBe('hash-1')
  })

  it('doc theo URL co fragment → van ra cung entry', async () => {
    await writeCachedContext({
      url: 'https://example.com/bai-viet',
      title: 'Bai viet',
      text: 'Noi dung chinh.',
      excerpt: undefined,
      sourceKind: 'html',
      contentHash: 'hash-1',
      capturedAt: NOW,
    })

    const cached = await readCachedContext('https://example.com/bai-viet#phan-2', NOW)

    expect(cached?.text).toBe('Noi dung chinh.')
  })

  it('URL khac → undefined', async () => {
    await writeCachedContext({
      url: 'https://example.com/a',
      title: 'A',
      text: 'A',
      excerpt: undefined,
      sourceKind: 'html',
      contentHash: 'hash-a',
      capturedAt: NOW,
    })

    expect(await readCachedContext('https://example.com/b', NOW)).toBeUndefined()
  })

  it('URL rong → undefined (khong ghi)', async () => {
    await writeCachedContext({
      url: '',
      title: 'A',
      text: 'A',
      excerpt: undefined,
      sourceKind: 'html',
      contentHash: 'hash-a',
      capturedAt: NOW,
    })

    expect(await readCachedContext('', NOW)).toBeUndefined()
  })

  it('ghi lai cung URL → ghi de, khong nhan ban', async () => {
    const base = {
      url: 'https://example.com/a',
      title: 'A',
      text: 'A',
      excerpt: undefined,
      sourceKind: 'html' as const,
      contentHash: 'hash-a',
      capturedAt: NOW,
    }

    await writeCachedContext(base)
    await writeCachedContext({ ...base, text: 'A moi', contentHash: 'hash-a2' })

    const cached = await readCachedContext('https://example.com/a', NOW)
    expect(cached?.text).toBe('A moi')
    expect(cached?.contentHash).toBe('hash-a2')
  })
})

describe('TTL', () => {
  it('entry qua TTL → undefined', async () => {
    await writeCachedContext({
      url: 'https://example.com/a',
      title: 'A',
      text: 'A',
      excerpt: undefined,
      sourceKind: 'html',
      contentHash: 'hash-a',
      capturedAt: NOW,
    })

    const expired = await readCachedContext(
      'https://example.com/a',
      NOW + CONTEXT_CACHE_TTL_MS + 1,
    )

    expect(expired).toBeUndefined()
  })

  it('entry chua qua TTL → van tra ve', async () => {
    await writeCachedContext({
      url: 'https://example.com/a',
      title: 'A',
      text: 'A',
      excerpt: undefined,
      sourceKind: 'html',
      contentHash: 'hash-a',
      capturedAt: NOW,
    })

    const fresh = await readCachedContext('https://example.com/a', NOW + CONTEXT_CACHE_TTL_MS - 1)

    expect(fresh).toBeDefined()
  })

  it('entry het han bi xoa khoi storage', async () => {
    await writeCachedContext({
      url: 'https://example.com/a',
      title: 'A',
      text: 'A',
      excerpt: undefined,
      sourceKind: 'html',
      contentHash: 'hash-a',
      capturedAt: NOW,
    })

    await readCachedContext('https://example.com/a', NOW + CONTEXT_CACHE_TTL_MS + 1)

    // Doc lai o thoi diem hien tai → entry da bi xoa → undefined.
    expect(await readCachedContext('https://example.com/a', NOW + 1)).toBeUndefined()
  })
})

describe('prune', () => {
  it('vuot gioi han → giu entry moi nhat', async () => {
    const total = CONTEXT_CACHE_MAX_ENTRIES + 5

    for (let index = 0; index < total; index += 1) {
      await writeCachedContext({
        url: `https://example.com/${index}`,
        title: `Trang ${index}`,
        text: `Noi dung ${index}`,
        excerpt: undefined,
        sourceKind: 'html',
        contentHash: `hash-${index}`,
        capturedAt: NOW + index,
      })
    }

    // Entry moi nhat van con.
    const newest = await readCachedContext(`https://example.com/${total - 1}`, NOW + total)
    expect(newest).toBeDefined()

    // Entry cu nhat da bi loai.
    const oldest = await readCachedContext('https://example.com/0', NOW + total)
    expect(oldest).toBeUndefined()
  })
})

describe('toCacheEntry', () => {
  it('tinh contentHash tu text', () => {
    const entry = toCacheEntry(
      { url: 'https://example.com/a', title: 'A', text: 'Noi dung', sourceKind: 'html' },
      NOW,
    )

    expect(entry.contentHash).toHaveLength(8)
    expect(entry.key).toBe(contextHashKey('https://example.com/a'))
    expect(entry.capturedAt).toBe(NOW)
  })

  it('khong co text → contentHash cua chuoi rong (van on dinh)', () => {
    const entry = toCacheEntry({ url: 'https://example.com/a', title: 'A' }, NOW)

    expect(entry.text).toBe('')
    expect(entry.contentHash).toHaveLength(8)
  })
})

describe('hasContentChanged', () => {
  const base = {
    key: 'k',
    url: 'https://example.com/a',
    title: 'A',
    text: 'Noi dung',
    excerpt: undefined,
    sourceKind: 'html' as const,
    contentHash: 'hash-1',
    capturedAt: NOW,
  }

  it('khong co ban cache → co thay doi', () => {
    expect(hasContentChanged(undefined, base)).toBe(true)
  })

  it('cung contentHash → khong doi', () => {
    expect(hasContentChanged(base, { ...base })).toBe(false)
  })

  it('khac contentHash → co thay doi', () => {
    expect(hasContentChanged(base, { ...base, contentHash: 'hash-2' })).toBe(true)
  })
})

describe('clearContextCache', () => {
  it('xoa toan bo cache', async () => {
    await writeCachedContext({
      url: 'https://example.com/a',
      title: 'A',
      text: 'A',
      excerpt: undefined,
      sourceKind: 'html',
      contentHash: 'hash-a',
      capturedAt: NOW,
    })

    await clearContextCache()

    expect(await readCachedContext('https://example.com/a', NOW)).toBeUndefined()
  })
})
