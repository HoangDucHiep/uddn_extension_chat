import { beforeEach, describe, expect, it } from 'vitest'
import {
  PANEL_OPEN_STATE_KEY,
  applyOpenOnActionClick,
  closeSidePanel,
  isOpenOnActionClick,
  openSidePanel,
  readPanelOpenState,
  toggleSidePanel,
  writePanelOpenState,
} from '../src/background/panelController.js'

/**
 * Unit test cho `background/panelController.ts` — mo/dong/toggle side panel
 * (T-M1-03, FR-UX-01).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.13
 */

const {
  sidePanelOpenMock,
  sidePanelCloseMock,
  sidePanelSetBehaviorMock,
  sidePanelGetBehaviorMock,
  windowsGetCurrentMock,
} = await import('./setup.js')

beforeEach(() => {
  sidePanelOpenMock.mockReset()
  sidePanelOpenMock.mockResolvedValue(undefined)
  sidePanelCloseMock.mockReset()
  sidePanelCloseMock.mockResolvedValue(undefined)
  sidePanelSetBehaviorMock.mockReset()
  sidePanelSetBehaviorMock.mockResolvedValue(undefined)
  sidePanelGetBehaviorMock.mockReset()
  sidePanelGetBehaviorMock.mockResolvedValue({ openPanelOnActionClick: false })
  windowsGetCurrentMock.mockReset()
  windowsGetCurrentMock.mockResolvedValue({
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
  })
})

describe('applyOpenOnActionClick', () => {
  it('bat native toggle bang setPanelBehavior', async () => {
    const applied = await applyOpenOnActionClick()

    expect(applied).toBe(true)
    expect(sidePanelSetBehaviorMock).toHaveBeenCalledWith({ openPanelOnActionClick: true })
  })

  it('Chrome loi → tra false, khong throw', async () => {
    sidePanelSetBehaviorMock.mockRejectedValue(new Error('unsupported'))

    await expect(applyOpenOnActionClick()).resolves.toBe(false)
  })
})

describe('isOpenOnActionClick', () => {
  it('doc behavior tu Chrome', async () => {
    sidePanelGetBehaviorMock.mockResolvedValue({ openPanelOnActionClick: true })

    await expect(isOpenOnActionClick()).resolves.toBe(true)
  })

  it('behavior khong bat → false', async () => {
    sidePanelGetBehaviorMock.mockResolvedValue({ openPanelOnActionClick: false })

    await expect(isOpenOnActionClick()).resolves.toBe(false)
  })

  it('Chrome loi → false, khong throw', async () => {
    sidePanelGetBehaviorMock.mockRejectedValue(new Error('unsupported'))

    await expect(isOpenOnActionClick()).resolves.toBe(false)
  })
})

describe('readPanelOpenState / writePanelOpenState', () => {
  it('ghi va doc trang thai panel trong storage.session', async () => {
    await writePanelOpenState(true)
    await expect(readPanelOpenState()).resolves.toBe(true)

    await writePanelOpenState(false)
    await expect(readPanelOpenState()).resolves.toBe(false)
  })

  it('dung key chung cho service worker', () => {
    expect(PANEL_OPEN_STATE_KEY).toBe('sidekick.panelOpen')
  })
})

describe('openSidePanel', () => {
  it('mo panel o window da cho', async () => {
    const opened = await openSidePanel(7)

    expect(opened).toBe(true)
    expect(sidePanelOpenMock).toHaveBeenCalledWith({ windowId: 7 })
  })

  it('khong co windowId → fallback sang cua so hien tai', async () => {
    const opened = await openSidePanel()

    expect(opened).toBe(true)
    expect(windowsGetCurrentMock).toHaveBeenCalled()
    expect(sidePanelOpenMock).toHaveBeenCalledWith({ windowId: 1 })
  })

  it('khong xac dinh duoc windowId → false, khong goi open', async () => {
    windowsGetCurrentMock.mockResolvedValue(undefined)

    const opened = await openSidePanel()

    expect(opened).toBe(false)
    expect(sidePanelOpenMock).not.toHaveBeenCalled()
  })

  it('Chrome tu choi (khong co user gesture) → false, khong throw', async () => {
    sidePanelOpenMock.mockRejectedValue(new Error('no user gesture'))

    await expect(openSidePanel(7)).resolves.toBe(false)
  })
})

describe('closeSidePanel', () => {
  it('dong panel o window da cho', async () => {
    const closed = await closeSidePanel(9)

    expect(closed).toBe(true)
    expect(sidePanelCloseMock).toHaveBeenCalledWith({ windowId: 9 })
  })

  it('khong co windowId → fallback sang cua so hien tai', async () => {
    const closed = await closeSidePanel()

    expect(closed).toBe(true)
    expect(sidePanelCloseMock).toHaveBeenCalledWith({ windowId: 1 })
  })

  it('Chrome < 141 (khong co API close) → false, khong throw', async () => {
    const original = chrome.sidePanel.close
    ;(chrome.sidePanel as { close?: unknown }).close = undefined

    const closed = await closeSidePanel(9)

    expect(closed).toBe(false)
    expect(sidePanelCloseMock).not.toHaveBeenCalled()

    ;(chrome.sidePanel as { close?: unknown }).close = original
  })

  it('Chrome loi → false, khong throw', async () => {
    sidePanelCloseMock.mockRejectedValue(new Error('already closed'))

    await expect(closeSidePanel(9)).resolves.toBe(false)
  })
})

describe('toggleSidePanel', () => {
  it('panel dang dong → mo panel', async () => {
    await writePanelOpenState(false)

    const result = await toggleSidePanel(7)

    expect(result).toBe('opened')
    expect(sidePanelOpenMock).toHaveBeenCalledWith({ windowId: 7 })
    expect(sidePanelCloseMock).not.toHaveBeenCalled()
  })

  it('panel dang mo → dong panel', async () => {
    await writePanelOpenState(true)

    const result = await toggleSidePanel(7)

    expect(result).toBe('closed')
    expect(sidePanelCloseMock).toHaveBeenCalledWith({ windowId: 7 })
    expect(sidePanelOpenMock).not.toHaveBeenCalled()
  })

  it('mo that bai → noop', async () => {
    await writePanelOpenState(false)
    sidePanelOpenMock.mockRejectedValue(new Error('no user gesture'))

    await expect(toggleSidePanel(7)).resolves.toBe('noop')
  })

  it('dong that bai → noop', async () => {
    await writePanelOpenState(true)
    sidePanelCloseMock.mockRejectedValue(new Error('already closed'))

    await expect(toggleSidePanel(7)).resolves.toBe('noop')
  })
})
