import { vi } from 'vitest'

/**
 * Setup cho test extension.
 * Mock `chrome.*` API vi khong co extension context trong jsdom.
 */

interface StorageArea {
  get: (key: string | string[] | null) => Promise<Record<string, unknown>>
  set: (items: Record<string, unknown>) => Promise<void>
  remove: (key: string | string[]) => Promise<void>
}

const storage: Record<string, unknown> = {}

/** Storage cua `chrome.storage.session` — tach rieng voi `local`. */
const sessionStorage: Record<string, unknown> = {}

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

/** Mock `chrome.sidePanel.close` (Chrome 141+). */
const sidePanelCloseMock = vi.fn(async (_options: chrome.sidePanel.CloseOptions): Promise<void> => undefined)

/** Mock `chrome.sidePanel.setPanelBehavior` — tra ve behavior da dat. */
const sidePanelSetBehaviorMock = vi.fn(
  async (_behavior: chrome.sidePanel.PanelBehavior): Promise<void> => undefined,
)

/** Mock `chrome.sidePanel.getPanelBehavior` — behavior hien tai. */
const sidePanelGetBehaviorMock = vi.fn(
  async (): Promise<chrome.sidePanel.PanelBehavior> => ({ openPanelOnActionClick: false }),
)

/** Mock `chrome.windows.getCurrent` — id cua so hien tai. */
const windowsGetCurrentMock = vi.fn(async (): Promise<chrome.windows.Window | undefined> => ({
  id: 1,
  focused: true,
  top: 0,
  left: 0,
  width: 1280,
  height: 720,
  incognito: false,
  state: 'normal',
  type: 'normal',
  alwaysOnTop: false,
}))

/** Mock `chrome.contextMenus.create` — ghi lai thuoc tinh tao menu. */
const contextMenusCreateMock = vi.fn((_properties: chrome.contextMenus.CreateProperties): string => {
  const id = _properties.id ?? 'menu-auto'
  contextMenusCreated.push({
    id,
    title: _properties.title,
    contexts: _properties.contexts as readonly string[] | undefined,
  })
  return id
})

/** Danh sach menu da tao (de test assert). */
const contextMenusCreated: Array<{
  id: string
  title: string | undefined
  contexts: readonly string[] | undefined
}> = []

/** Mock `chrome.contextMenus.removeAll`. */
const contextMenusRemoveAllMock = vi.fn(async (): Promise<void> => {
  contextMenusCreated.length = 0
})

/**
 * Mock `chrome.tabs.create`.
 *
 * Mac dinh **reject** nhu Chrome that (chan URL `chrome://`) → test phai
 * mock lai khi can trong truong hop thanh cong.
 */
const tabsCreateMock = vi.fn(
  async (_properties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> => {
    throw new Error('Khong the mo URL chrome://')
  },
)

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
      get: vi.fn(async (key: string | string[] | null) => {
        if (key === null || key === undefined) return { ...storage }
        const keys = Array.isArray(key) ? key : [key]
        const result: Record<string, unknown> = {}
        for (const item of keys) {
          if (item in storage) result[item] = storage[item]
        }
        return result
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
      remove: vi.fn(async (key: string | string[]) => {
        const keys = Array.isArray(key) ? key : [key]
        const changes: Record<string, chrome.storage.StorageChange> = {}
        for (const item of keys) {
          changes[item] = { oldValue: storage[item], newValue: undefined }
          delete storage[item]
        }
        fireStorageChanged(changes)
      }),
    } satisfies StorageArea,
    session: {
      get: vi.fn(async (key: string | string[] | null) => {
        if (key === null || key === undefined) return { ...sessionStorage }
        const keys = Array.isArray(key) ? key : [key]
        const result: Record<string, unknown> = {}
        for (const item of keys) {
          if (item in sessionStorage) result[item] = sessionStorage[item]
        }
        return result
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(sessionStorage, items)
      }),
      remove: vi.fn(async (key: string | string[]) => {
        const keys = Array.isArray(key) ? key : [key]
        for (const item of keys) {
          delete sessionStorage[item]
        }
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
    onInstalled: { addListener: vi.fn() },
    onStartup: { addListener: vi.fn() },
    id: 'sidekick-test-extension-id',
    getURL: vi.fn((path: string) => `chrome-extension://sidekick-test-extension-id/${path}`),
  },
  sidePanel: {
    open: sidePanelOpenMock,
    close: sidePanelCloseMock,
    setPanelBehavior: sidePanelSetBehaviorMock,
    getPanelBehavior: sidePanelGetBehaviorMock,
    onOpened: { addListener: vi.fn() },
    onClosed: { addListener: vi.fn() },
  },
  contextMenus: {
    create: contextMenusCreateMock,
    removeAll: contextMenusRemoveAllMock,
    onClicked: { addListener: vi.fn() },
  },
  commands: {
    onCommand: { addListener: vi.fn() },
  },
  action: {
    onClicked: { addListener: vi.fn() },
  },
  windows: {
    getCurrent: windowsGetCurrentMock,
  },
  tabs: {
    get: tabsGetMock,
    query: tabsQueryMock,
    create: tabsCreateMock,
  },
  scripting: {
    executeScript: executeScriptMock,
  },
}

globalThis.chrome = chromeMock as unknown as typeof chrome

export {
  contextMenusCreateMock,
  contextMenusCreated,
  contextMenusRemoveAllMock,
  fireStorageChanged,
  sidePanelOpenMock,
  sidePanelCloseMock,
  sidePanelSetBehaviorMock,
  sidePanelGetBehaviorMock,
  storageChangedListeners,
  executeScriptMock,
  injectionResult,
  tabsCreateMock,
  tabsQueryMock,
  windowsGetCurrentMock,
}
