import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  clearModelSelection,
  MODEL_SELECTION_STORAGE_KEY,
  readModelSelection,
  writeModelSelection,
} from '../src/lib/modelSelection'

/**
 * Unit test cho luu lua chon provider + model (T-M2-02 — FR-PROVIDER-03).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.22
 */

/** Mock `chrome.storage.local` bang Map trong bo nho. */
function mockStorage(): {
  store: Map<string, unknown>
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
} {
  const store = new Map<string, unknown>()
  const get = vi.fn(async (key: string) => {
    if (!store.has(key)) return {}
    return { [key]: store.get(key) }
  })
  const set = vi.fn(async (items: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(items)) store.set(key, value)
  })
  const remove = vi.fn(async (key: string) => {
    store.delete(key)
  })

  vi.stubGlobal('chrome', {
    storage: { local: { get, set, remove } },
  })

  return { store, get, set, remove }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('readModelSelection', () => {
  it('tra lua chon rong khi chua luu gi', async () => {
    mockStorage()

    const selection = await readModelSelection()

    expect(selection.providerId).toBeUndefined()
    expect(selection.model).toBeUndefined()
  })

  it('doc dung lua chon da luu', async () => {
    const storage = mockStorage()
    storage.store.set(MODEL_SELECTION_STORAGE_KEY, {
      providerId: 'groq',
      model: 'llama-3.3-70b',
    })

    const selection = await readModelSelection()

    expect(selection.providerId).toBe('groq')
    expect(selection.model).toBe('llama-3.3-70b')
  })

  it('bo qua provider id khong hop le', async () => {
    const storage = mockStorage()
    storage.store.set(MODEL_SELECTION_STORAGE_KEY, {
      providerId: 'khong-ton-tai',
      model: 'model-x',
    })

    const selection = await readModelSelection()

    expect(selection.providerId).toBeUndefined()
    expect(selection.model).toBe('model-x')
  })

  it('tra lua chon rong khi du lieu luu khong phai object', async () => {
    const storage = mockStorage()
    storage.store.set(MODEL_SELECTION_STORAGE_KEY, 'khong-phai-object')

    const selection = await readModelSelection()

    expect(selection.providerId).toBeUndefined()
    expect(selection.model).toBeUndefined()
  })

  it('tra lua chon rong khi storage loi', async () => {
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(async () => {
            throw new Error('storage loi')
          }),
        },
      },
    })

    const selection = await readModelSelection()

    expect(selection.providerId).toBeUndefined()
    expect(selection.model).toBeUndefined()
  })
})

describe('writeModelSelection', () => {
  it('luu provider + model vao storage', async () => {
    const storage = mockStorage()

    await writeModelSelection({ providerId: 'gemini', model: 'gemini-3.6-flash' })

    expect(storage.store.get(MODEL_SELECTION_STORAGE_KEY)).toEqual({
      providerId: 'gemini',
      model: 'gemini-3.6-flash',
    })
  })

  it('luu null khi bo chon', async () => {
    const storage = mockStorage()

    await writeModelSelection({ providerId: undefined, model: undefined })

    expect(storage.store.get(MODEL_SELECTION_STORAGE_KEY)).toEqual({
      providerId: null,
      model: null,
    })
  })

  it('khong nem loi khi storage that bai', async () => {
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          set: vi.fn(async () => {
            throw new Error('storage loi')
          }),
        },
      },
    })

    await expect(
      writeModelSelection({ providerId: 'groq', model: 'x' }),
    ).resolves.toBeUndefined()
  })
})

describe('clearModelSelection', () => {
  it('xoa khoa luu lua chon', async () => {
    const storage = mockStorage()
    storage.store.set(MODEL_SELECTION_STORAGE_KEY, { providerId: 'groq', model: 'x' })

    await clearModelSelection()

    expect(storage.remove).toHaveBeenCalledWith(MODEL_SELECTION_STORAGE_KEY)
    expect(storage.store.has(MODEL_SELECTION_STORAGE_KEY)).toBe(false)
  })
})
