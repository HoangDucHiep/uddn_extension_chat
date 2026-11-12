import { beforeEach, describe, expect, it } from 'vitest'
import {
  CONTEXT_MENU_ASK_SELECTION_ID,
  CONTEXT_MENU_OPEN_ID,
  handleContextMenuClick,
  registerContextMenus,
} from '../src/background/contextMenus.js'
import { PENDING_SELECTION_STORAGE_KEY } from '../src/lib/storage.js'

/**
 * Unit test cho `background/contextMenus.ts` — context menu "Mo Sidekick AI"
 * + "Hoi Sidekick voi doan da chon" (T-M1-03, FR-UX-01).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.13
 */

const { contextMenusCreated, contextMenusRemoveAllMock, sidePanelOpenMock } =
  await import('./setup.js')

beforeEach(() => {
  contextMenusCreated.length = 0
  contextMenusRemoveAllMock.mockClear()
  sidePanelOpenMock.mockReset()
  sidePanelOpenMock.mockResolvedValue(undefined)
  // Storage mock dung chung cho ca file → xoa de moi test doc trang thai sach.
  void chrome.storage.local.remove(PENDING_SELECTION_STORAGE_KEY)
})

/** Doc storage.local trong test (doi voi `chrome.storage.local` mock). */
async function readPendingSelection(): Promise<Record<string, unknown> | undefined> {
  const stored = await chrome.storage.local.get(PENDING_SELECTION_STORAGE_KEY)
  const value = stored[PENDING_SELECTION_STORAGE_KEY]
  if (typeof value !== 'object' || value === null) return undefined
  return value as Record<string, unknown>
}

describe('registerContextMenus', () => {
  it('removeAll truoc khi create (idempotent, khong duplicate id)', async () => {
    await registerContextMenus()

    expect(contextMenusRemoveAllMock).toHaveBeenCalled()
    expect(contextMenusCreated).toHaveLength(2)
  })

  it('tao 2 muc: mo panel + hoi doan da chon', async () => {
    await registerContextMenus()

    const open = contextMenusCreated.find((item) => item.id === CONTEXT_MENU_OPEN_ID)
    const ask = contextMenusCreated.find(
      (item) => item.id === CONTEXT_MENU_ASK_SELECTION_ID,
    )

    expect(open?.title).toBe('Mở Sidekick AI')
    expect(open?.contexts).toEqual(['page'])
    expect(ask?.title).toBe('Hỏi Sidekick với đoạn đã chọn')
    expect(ask?.contexts).toEqual(['selection'])
  })

  it('goi 2 lan khong nem loi duplicate id', async () => {
    await registerContextMenus()
    await expect(registerContextMenus()).resolves.toBeUndefined()
  })
})

describe('handleContextMenuClick', () => {
  it('muc "mo panel" → sidePanel.open', async () => {
    await handleContextMenuClick(
      { menuItemId: CONTEXT_MENU_OPEN_ID, editable: false },
      { id: 5, windowId: 3, title: 'Trang' } as chrome.tabs.Tab,
    )

    expect(sidePanelOpenMock).toHaveBeenCalledWith({ windowId: 3 })
  })

  it('muc "hoi doan da chon" → ghi pending selection + mo panel', async () => {
    await handleContextMenuClick(
      {
        menuItemId: CONTEXT_MENU_ASK_SELECTION_ID,
        editable: false,
        selectionText: 'Doan van ban user boi den tren trang',
        pageUrl: 'https://example.com/bai-viet',
      },
      { id: 5, windowId: 3, title: 'Bai viet mau' } as chrome.tabs.Tab,
    )

    const pending = await readPendingSelection()
    expect(pending).toBeDefined()
    expect(pending?.['text']).toBe('Doan van ban user boi den tren trang')
    expect(pending?.['url']).toBe('https://example.com/bai-viet')
    expect(pending?.['title']).toBe('Bai viet mau')
    expect(pending?.['tabId']).toBe(5)
    expect(String(pending?.['id'])).toMatch(/^selection-/)

    expect(sidePanelOpenMock).toHaveBeenCalledWith({ windowId: 3 })
  })

  it('selection rong → khong ghi, khong mo panel', async () => {
    await handleContextMenuClick(
      {
        menuItemId: CONTEXT_MENU_ASK_SELECTION_ID,
        editable: false,
        selectionText: '   ',
      },
      { id: 5, windowId: 3 } as chrome.tabs.Tab,
    )

    await expect(readPendingSelection()).resolves.toBeUndefined()
    expect(sidePanelOpenMock).not.toHaveBeenCalled()
  })

  it('menu id la → bo qua', async () => {
    await handleContextMenuClick(
      { menuItemId: 'khong-phai-sidekick', editable: false },
      { id: 5, windowId: 3 } as chrome.tabs.Tab,
    )

    await expect(readPendingSelection()).resolves.toBeUndefined()
    expect(sidePanelOpenMock).not.toHaveBeenCalled()
  })
})
