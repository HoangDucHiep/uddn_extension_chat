import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import {
  CONTEXT_ENABLED_STORAGE_KEY,
  PENDING_SELECTION_STORAGE_KEY,
  clearPendingSelection,
  consumePendingSelection,
  readContextEnabled,
  readPendingSelection,
  writeContextEnabled,
  writePendingSelection,
} from '../src/lib/storage.js'
import { SELECTION_PENDING_TTL_MS } from '@sidekick/shared/constants'

/**
 * Unit test cho `lib/storage` — doc/ghi `chrome.storage.local`.
 * Docs: docs/SYSTEM_DESIGN.md §3 (lib/storage.ts)
 */

/** Mock `chrome.storage.local` co the lap trinh. */
function mockStorage(options: { failOnGet?: boolean; failOnSet?: boolean } = {}): {
  get: Mock<(key: string) => Promise<Record<string, unknown>>>
  set: Mock<(items: Record<string, unknown>) => Promise<void>>
  remove: Mock<(key: string) => Promise<void>>
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

  const remove = vi.fn(async (key: string): Promise<void> => {
    delete data[key]
  })

  vi.stubGlobal('chrome', { storage: { local: { get, set, remove } } })

  return { get, set, remove }
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

describe('pending selection (T-M1-02)', () => {
  /** Payload selection hop le. */
  const selection = {
    id: 'selection-abc',
    text: 'Doan van ban da boi den tren trang web',
    url: 'https://example.com/',
    title: 'Bai viet mau',
    tabId: 42,
    createdAt: 1_700_000_000_000,
  }

  it('write → read trong cung store', async () => {
    mockStorage()

    await writePendingSelection(selection)

    expect(await readPendingSelection(selection.createdAt)).toEqual(selection)
  })

  it('consume tra ve doan va xoa khoi storage', async () => {
    mockStorage()
    await writePendingSelection(selection)

    const consumed = await consumePendingSelection(selection.createdAt)

    expect(consumed).toEqual(selection)
    // Consolve lan 2 → rong (khong dinh kem lai).
    expect(await readPendingSelection(selection.createdAt)).toBeUndefined()
  })

  it('doan qua TTL → undefined (khong dinh kem nham)', async () => {
    mockStorage()
    await writePendingSelection(selection)

    const expiredAt = selection.createdAt + SELECTION_PENDING_TTL_MS + 1

    expect(await readPendingSelection(expiredAt)).toBeUndefined()
  })

  it('doan qua TTL → bi xoa khoi storage', async () => {
    const storage = mockStorage()
    await writePendingSelection(selection)

    const expiredAt = selection.createdAt + SELECTION_PENDING_TTL_MS + 1
    await readPendingSelection(expiredAt)

    expect(storage.remove).toHaveBeenCalledWith(PENDING_SELECTION_STORAGE_KEY)
  })
  it('doan dung tuoi TTL van con hieu luc', async () => {
    mockStorage()
    await writePendingSelection(selection)

    const atLimit = selection.createdAt + SELECTION_PENDING_TTL_MS

    expect(await readPendingSelection(atLimit)).toEqual(selection)
  })

  it('khong co du lieu → undefined', async () => {
    mockStorage()

    expect(await readPendingSelection()).toBeUndefined()
  })

  it('payload sai shape → undefined', async () => {
    const storage = mockStorage()
    await storage.set({ [PENDING_SELECTION_STORAGE_KEY]: { text: 123 } })

    expect(await readPendingSelection()).toBeUndefined()
  })

  it('createdAt khong phai so → undefined', async () => {
    const storage = mockStorage()
    await storage.set({ [PENDING_SELECTION_STORAGE_KEY]: { text: 'x', createdAt: 'now' } })

    expect(await readPendingSelection()).toBeUndefined()
  })

  it('consume khi khong co du lieu → undefined', async () => {
    mockStorage()

    expect(await consumePendingSelection()).toBeUndefined()
  })

  it('clearPendingSelection xoa khoi storage', async () => {
    const storage = mockStorage()
    await writePendingSelection(selection)

    await clearPendingSelection()

    expect(storage.remove).toHaveBeenCalledWith(PENDING_SELECTION_STORAGE_KEY)
    expect(await readPendingSelection(selection.createdAt)).toBeUndefined()
  })

  it('storage that bai → khong throw', async () => {
    mockStorage({ failOnSet: true })

    await expect(writePendingSelection(selection)).resolves.toBeUndefined()
  })

  it('storage that bai khi doc → undefined, khong throw', async () => {
    mockStorage({ failOnGet: true })

    expect(await readPendingSelection()).toBeUndefined()
    expect(await consumePendingSelection()).toBeUndefined()
  })
})
