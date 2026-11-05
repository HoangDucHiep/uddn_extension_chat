import { describe, expect, it, vi, beforeEach } from 'vitest'
import { handleRuntimeMessage, handleSelectionMessage, tryOpenSidePanel } from '../src/lib/selectionBridge.js'
import { PENDING_SELECTION_STORAGE_KEY } from '../src/lib/storage.js'
import { SELECTION_ACTION } from '../src/lib/selectionProtocol.js'
import type * as StorageModule from '../src/lib/storage.js'

/**
 * Unit test cho `lib/selectionBridge.ts` — cau noi content script → service
 * worker → panel (T-M1-02).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.4
 */

const writePendingSelectionMock = vi.fn()

vi.mock('@/lib/storage', async () => {
  const actual = await vi.importActual<typeof StorageModule>('../src/lib/storage.js')
  return {
    ...actual,
    writePendingSelection: (selection: unknown) => writePendingSelectionMock(selection),
  }
})

const { sidePanelOpenMock } = await import('./setup.js')

/** Payload selection hop le. */
const selection = {
  id: 'selection-abc',
  text: 'Doan van ban da boi den tren trang web',
  url: 'https://example.com/',
  title: 'Bai viet mau',
  tabId: 42,
  createdAt: 1_700_000_000_000,
}

beforeEach(() => {
  writePendingSelectionMock.mockReset()
  sidePanelOpenMock.mockReset()
  sidePanelOpenMock.mockResolvedValue(undefined)
})

describe('handleSelectionMessage', () => {
  it('luu doan chon vao storage', async () => {
    const result = await handleSelectionMessage(selection, 7)

    expect(writePendingSelectionMock).toHaveBeenCalledWith(selection)
    expect(result.stored).toBe(true)
  })

  it('mo side panel khi co windowId', async () => {
    const result = await handleSelectionMessage(selection, 7)

    expect(sidePanelOpenMock).toHaveBeenCalledWith({ windowId: 7 })
    expect(result.panelOpened).toBe(true)
  })

  it('sidePanel.open that bai → van luu doan chon, khong throw', async () => {
    sidePanelOpenMock.mockRejectedValue(new Error('no user gesture'))

    const result = await handleSelectionMessage(selection, 7)

    expect(writePendingSelectionMock).toHaveBeenCalled()
    expect(result.panelOpened).toBe(false)
  })

  it('khong co windowId → khong goi sidePanel.open', async () => {
    const result = await handleSelectionMessage(selection, undefined)

    expect(sidePanelOpenMock).not.toHaveBeenCalled()
    expect(result.panelOpened).toBe(false)
    expect(result.stored).toBe(true)
  })
})

describe('tryOpenSidePanel', () => {
  it('tra true khi mo thanh cong', async () => {
    expect(await tryOpenSidePanel(3)).toBe(true)
  })

  it('tra false khi Chrome tu choi', async () => {
    sidePanelOpenMock.mockRejectedValue(new Error('no user gesture'))

    expect(await tryOpenSidePanel(3)).toBe(false)
  })
})

describe('handleRuntimeMessage', () => {
  it('xu ly message selection hop le', async () => {
    const result = await handleRuntimeMessage(
      { action: SELECTION_ACTION, payload: selection },
      { tab: { id: 42, windowId: 7 } } as chrome.runtime.MessageSender,
    )

    expect(result?.stored).toBe(true)
    expect(writePendingSelectionMock).toHaveBeenCalledWith(selection)
  })

  it('bo qua message khac action', async () => {
    const result = await handleRuntimeMessage(
      { action: 'sidekick:extract-content' },
      { tab: { id: 1, windowId: 1 } } as chrome.runtime.MessageSender,
    )

    expect(result).toBeUndefined()
    expect(writePendingSelectionMock).not.toHaveBeenCalled()
  })

  it('bo qua payload sai shape', async () => {
    const result = await handleRuntimeMessage(
      { action: SELECTION_ACTION, payload: { text: 123 } },
      { tab: { id: 1, windowId: 1 } } as chrome.runtime.MessageSender,
    )

    expect(result).toBeUndefined()
    expect(writePendingSelectionMock).not.toHaveBeenCalled()
  })

  it('khong windowId trong sender → van luu doan chon', async () => {
    const result = await handleRuntimeMessage(
      { action: SELECTION_ACTION, payload: selection },
      {} as chrome.runtime.MessageSender,
    )

    expect(result?.stored).toBe(true)
    expect(result?.panelOpened).toBe(false)
  })
})

describe('storage key', () => {
  it('dung key chung cho ca content script va panel', () => {
    expect(PENDING_SELECTION_STORAGE_KEY).toBe('sidekick.pendingSelection')
  })
})
