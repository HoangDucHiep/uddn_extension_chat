import { vi } from 'vitest'

/**
 * Setup cho test extension.
 * Mock `chrome.*` API vi khong co extension context trong jsdom.
 */

interface StorageArea {
  get: (key: string) => Promise<Record<string, unknown>>
  set: (items: Record<string, unknown>) => Promise<void>
  remove: (key: string) => Promise<void>
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

/**
 * Injection result gia lap — `executeScript` tra `{ result }` kem
 * `documentId` + `frameId` (bat buoc theo type cua Chrome).
 */
function injectionResult(result: unknown): chrome.scripting.InjectionResult {
  return { result, documentId: 'doc-1', frameId: 0 }
}
const sidePanelOpenMock = vi.fn(async (_options: chrome.sidePanel.OpenOptions): Promise<void> => undefined)

/** Listener cua `chrome.storage.onChanged` — test goi de mo dong storage. */
type StorageChangedListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
) => void

const storageChangedListeners = new Set<StorageChangedListener>()

/** Ban `storage.onChanged` co the kich hoat listener da dang ky. */
function fireStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName = 'local',
): void {
  for (const listener of storageChangedListeners) {
    listener(changes, areaName)
  }
}

const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (key: string) => {
        if (key in storage) return { [key]: storage[key] }
        return {}
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        const changes: Record<string, chrome.storage.StorageChange> = {}
        for (const [key, newValue] of Object.entries(items)) {
          changes[key] = {
            oldValue: storage[key],
            newValue,
          }
        }
        Object.assign(storage, items)
        fireStorageChanged(changes)
      }),
      remove: vi.fn(async (key: string) => {
        const oldValue = storage[key]
        delete storage[key]
        fireStorageChanged({ [key]: { oldValue, newValue: undefined } })
      }),
    } satisfies StorageArea,
    onChanged: {
      addListener: vi.fn((listener: StorageChangedListener) => {
        storageChangedListeners.add(listener)
      }),
      removeListener: vi.fn((listener: StorageChangedListener) => {
        storageChangedListeners.delete(listener)
      }),
    },
  },
  runtime: {
    sendMessage: vi.fn(async () => undefined),
    onMessage: { addListener: vi.fn() },
  },
  sidePanel: {
    open: sidePanelOpenMock,
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

export {
  fireStorageChanged,
  sidePanelOpenMock,
  storageChangedListeners,
  executeScriptMock,
  injectionResult,
}
