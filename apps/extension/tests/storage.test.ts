import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import {
  CONTEXT_ENABLED_STORAGE_KEY,
  readContextEnabled,
  writeContextEnabled,
} from '../src/lib/storage.js'

/**
 * Unit test cho `lib/storage` — doc/ghi `chrome.storage.local`.
 * Docs: docs/SYSTEM_DESIGN.md §3 (lib/storage.ts)
 */

/** Mock `chrome.storage.local` co the lap trinh. */
function mockStorage(options: { failOnGet?: boolean; failOnSet?: boolean } = {}): {
  get: Mock<(key: string) => Promise<Record<string, unknown>>>
  set: Mock<(items: Record<string, unknown>) => Promise<void>>
} {
  const data: Record<string, unknown> = {}

  const get = vi.fn(async (key: string): Promise<Record<string, unknown>> => {
    if (options.failOnGet === true) throw new Error('storage unavailable')
    return key in data ? { [key]: data[key] } : {}
  })

  const set = vi.fn(async (items: Record<string, unknown>): Promise<void> => {
    if (options.failOnSet === true) throw new Error('quota exceeded')
    Object.assign(data, items)
  })

  vi.stubGlobal('chrome', { storage: { local: { get, set } } })

  return { get, set }
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('readContextEnabled', () => {
  it('mac dinh false khi chua luu gi', async () => {
    mockStorage()

    expect(await readContextEnabled()).toBe(false)
  })

  it('doc gia tri da luu trong cung mot store', async () => {
    const storage = mockStorage()
    await storage.set({ [CONTEXT_ENABLED_STORAGE_KEY]: true })

    expect(await readContextEnabled()).toBe(true)
  })

  it('gia tri khong phai boolean true → tra false', async () => {
    const storage = mockStorage()
    await storage.set({ [CONTEXT_ENABLED_STORAGE_KEY]: 'true' })

    expect(await readContextEnabled()).toBe(false)
  })

  it('gia tri false → tra false', async () => {
    const storage = mockStorage()
    await storage.set({ [CONTEXT_ENABLED_STORAGE_KEY]: false })

    expect(await readContextEnabled()).toBe(false)
  })

  it('storage that bai → tra false, khong throw', async () => {
    mockStorage({ failOnGet: true })

    expect(await readContextEnabled()).toBe(false)
  })

  it('doc dung key luu tru', async () => {
    const storage = mockStorage()

    await readContextEnabled()

    expect(storage.get).toHaveBeenCalledWith(CONTEXT_ENABLED_STORAGE_KEY)
  })
})

describe('writeContextEnabled', () => {
  it('ghi gia tri true vao storage.local', async () => {
    const storage = mockStorage()

    await writeContextEnabled(true)

    expect(storage.set).toHaveBeenCalledWith({ [CONTEXT_ENABLED_STORAGE_KEY]: true })
  })

  it('ghi gia tri false vao storage.local', async () => {
    const storage = mockStorage()

    await writeContextEnabled(false)

    expect(storage.set).toHaveBeenCalledWith({ [CONTEXT_ENABLED_STORAGE_KEY]: false })
  })

  it('vong lap ghi/doc giu dung gia tri', async () => {
    mockStorage()

    await writeContextEnabled(true)
    expect(await readContextEnabled()).toBe(true)

    await writeContextEnabled(false)
    expect(await readContextEnabled()).toBe(false)
  })

  it('storage that bai → khong throw', async () => {
    mockStorage({ failOnSet: true })

    await expect(writeContextEnabled(true)).resolves.toBeUndefined()
  })
})
