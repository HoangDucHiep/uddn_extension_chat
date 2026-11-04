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

/**
 * Mock duoc gan generic de `vi.mocked()` trong test giu dung chu ky ham
 * goc cua Chrome API (neu mock khong generic, TS suy ra `void`).
 */
const tabsGetMock = vi.fn(
  async (_tabId: number): Promise<chrome.tabs.Tab | undefined> => undefined,
)
const tabsQueryMock = vi.fn(
  async (_query: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> => [],
)
const executeScriptMock = vi.fn(
  async (
    _injection: chrome.scripting.ScriptInjection<[], unknown>,
  ): Promise<chrome.scripting.InjectionResult[]> => [],
)

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
  tabs: {
    get: tabsGetMock,
    query: tabsQueryMock,
  },
  scripting: {
    executeScript: executeScriptMock,
  },
}

globalThis.chrome = chromeMock as unknown as typeof chrome

export {}
