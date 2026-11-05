/**
 * Cache context theo URL — T-M1-06.
 *
 * Muc dich:
 *  1. Khong phai trich xuat lai mot trang da doc (ton thoi gian + request).
 *  2. **Fallback** khi trang dang loi (PDF scan, extractor rong, mat mang):
 *     dung lai noi dung da capture truoc do.
 *
 * Luu trong `chrome.storage.local` (key `sidekick.contextCache`) — KHONG nam
 * trong service worker (MV3 SW bi kill sau ~30s).
 *
 * Bao mat:
 *  - Co TTL (`CONTEXT_CACHE_TTL_MS`) → trang doi noi dung van duoc lay moi.
 *  - Co `contentHash` → biet noi dung co doi khong (trang cung URL nhung
 *    noi dung khac → dung ban moi, khong dung ban cu).
 *  - Gioi han so entry (`CONTEXT_CACHE_MAX_ENTRIES`) → khong phinh storage.
 *  - KHONG bao gio throw → loi storage chi can bo qua.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.5
 */

import {
  CONTEXT_CACHE_MAX_ENTRIES,
  CONTEXT_CACHE_TTL_MS,
  contextHashKey,
  hashString,
  type PageKind,
} from '@sidekick/shared'
import { CONTEXT_CACHE_STORAGE_KEY } from './storage'

/** Mot ban context da capture, dung de tai lai neu trang loi. */
export interface ContextCacheEntry {
  /** Khoa chuan hoa theo URL (`contextHashKey`). */
  key: string
  /** URL goc cua trang. */
  url: string
  /** Tieu de trang. */
  title: string
  /** Noi dung da trich xuat. */
  text: string
  /** Trich dan ngan (neu co). */
  excerpt: string | undefined
  /** Loai trang — `html` | `pdf` | `youtube` | `unknown`. */
  sourceKind: PageKind | undefined
  /** Hash cua `text` — dung de phat hien noi dung da doi. */
  contentHash: string
  /** Thoi diem capture (epoch ms). */
  capturedAt: number
}

/** Shape luu trong storage — map khoa → entry. */
type ContextCacheStore = Record<string, ContextCacheEntry>

/**
 * Doc cache context theo URL.
 *
 * - Entry khong ton tai → `undefined`.
 * - Entry het TTL → `undefined` (va bi xoa khi co the).
 * - Storage loi → `undefined` (khong throw).
 *
 * @param url - URL trang can doc cache.
 * @param now - Thoi diem hien tai (epoch ms) — inject de test.
 */
export async function readCachedContext(
  url: string,
  now = Date.now(),
): Promise<ContextCacheEntry | undefined> {
  const key = contextHashKey(url)
  if (key.length === 0) return undefined

  const store = await readStore()
  const entry = store[key]
  if (entry === undefined) return undefined

  if (now - entry.capturedAt > CONTEXT_CACHE_TTL_MS) {
    // Het han → xoa de khong giu noi dung cu.
    const next = { ...store }
    delete next[key]
    await writeStore(next)
    return undefined
  }

  return entry
}

/**
 * Ghi cache context theo URL (ghi de ban cung URL).
 *
 * - Prune khi vuot `CONTEXT_CACHE_MAX_ENTRIES` → xoa entry cu nhat.
 * - Storage loi → bo qua (khong throw).
 *
 * @param entry - Entry can ghi (truong `key` se duoc tinh lai tu `url`).
 */
export async function writeCachedContext(
  entry: Omit<ContextCacheEntry, 'key'>,
): Promise<void> {
  const key = contextHashKey(entry.url)
  if (key.length === 0) return

  const store = await readStore()

  const next: ContextCacheStore = {
    ...store,
    [key]: { ...entry, key },
  }

  await writeStore(prune(next))
}

/** Xoa toan bo cache context. */
export async function clearContextCache(): Promise<void> {
  await writeStore({})
}

/**
 * Tao entry cache tu context vua capture.
 *
 * @param context - Context do `captureTabContext()` tra ve.
 * @param now - Thoi diem hien tai (epoch ms) — inject de test.
 */
export function toCacheEntry(
  context: {
    url: string
    title: string
    text?: string | undefined
    excerpt?: string | undefined
    sourceKind?: PageKind | undefined
  },
  now = Date.now(),
): ContextCacheEntry {
  const text = context.text ?? ''
  return {
    key: contextHashKey(context.url),
    url: context.url,
    title: context.title,
    text,
    excerpt: context.excerpt,
    sourceKind: context.sourceKind,
    contentHash: hashString(text),
    capturedAt: now,
  }
}

/**
 * So sanh noi dung moi voi ban da cache.
 *
 * `undefined` → chua co ban cache → noi dung moi **khac**.
 *
 * @param cached - Ban da cache (neu co).
 * @param fresh - Ban moi vua capture.
 */
export function hasContentChanged(
  cached: ContextCacheEntry | undefined,
  fresh: ContextCacheEntry,
): boolean {
  if (cached === undefined) return true
  return cached.contentHash !== fresh.contentHash
}

/** Doc toan bo store tu storage (khong throw). */
async function readStore(): Promise<ContextCacheStore> {
  try {
    const stored = await chrome.storage.local.get(CONTEXT_CACHE_STORAGE_KEY)
    const value = stored[CONTEXT_CACHE_STORAGE_KEY]
    if (typeof value !== 'object' || value === null) return {}

    const result: ContextCacheStore = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (isCacheEntry(entry)) result[key] = entry
    }
    return result
  } catch {
    return {}
  }
}

/** Ghi store vao storage (khong throw). */
async function writeStore(store: ContextCacheStore): Promise<void> {
  try {
    await chrome.storage.local.set({ [CONTEXT_CACHE_STORAGE_KEY]: store })
  } catch {
    // Storage khong ghi duoc → bo qua, chat van chay binh thuong.
  }
}

/**
 * Giu toi da `CONTEXT_CACHE_MAX_ENTRIES` entry, uu tien giu entry moi nhat.
 *
 * @param store - Store hien tai.
 */
function prune(store: ContextCacheStore): ContextCacheStore {
  const entries = Object.values(store)
  if (entries.length <= CONTEXT_CACHE_MAX_ENTRIES) return store

  const sorted = [...entries].sort((a, b) => b.capturedAt - a.capturedAt)
  const kept = sorted.slice(0, CONTEXT_CACHE_MAX_ENTRIES)

  const result: ContextCacheStore = {}
  for (const entry of kept) result[entry.key] = entry
  return result
}

/** Type guard — chi nhan entry dung shape. */
function isCacheEntry(value: unknown): value is ContextCacheEntry {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Partial<ContextCacheEntry>
  return (
    typeof candidate.key === 'string' &&
    typeof candidate.url === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.text === 'string' &&
    typeof candidate.contentHash === 'string' &&
    typeof candidate.capturedAt === 'number' &&
    Number.isFinite(candidate.capturedAt)
  )
}
