import { vi } from 'vitest'

/**
 * Setup cho test extension.
 * Mock `chrome.*` API vi khong co extension context trong jsdom.
 */

interface StorageArea {
  get: (key: string) => Promise<Record<string, unknown>>
  set: (items: Record<string, unknown>) => Promise<void>
}

const storage: Record<string, unknown> = {}

const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (key: string) => {
        if (key in storage) return { [key]: storage[key] }
        return {}
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(storage, items)
      }),
    } satisfies StorageArea,
  },
  runtime: {
    sendMessage: vi.fn(async () => undefined),
    onMessage: { addListener: vi.fn() },
  },
}

globalThis.chrome = chromeMock as unknown as typeof chrome

export {}
