import { beforeEach, describe, expect, it, vi } from 'vitest'
import { COMMAND_TOGGLE_PANEL, handleCommand } from '../src/background/commands.js'
import type * as PanelControllerModule from '../src/background/panelController'

/**
 * Unit test cho `background/commands.ts` — phim tat toggle panel
 * (T-M1-03, FR-UX-01).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.13
 */

const toggleSidePanelMock = vi.hoisted(() => vi.fn())

vi.mock('../src/background/panelController.js', async () => {
  const actual = await vi.importActual<typeof PanelControllerModule>(
    '../src/background/panelController',
  )
  return {
    ...actual,
    toggleSidePanel: (windowId?: number) => toggleSidePanelMock(windowId),
  }
})

beforeEach(() => {
  toggleSidePanelMock.mockReset()
  toggleSidePanelMock.mockResolvedValue('opened')
})

describe('handleCommand', () => {
  it('command toggle → goi toggleSidePanel voi windowId cua tab', async () => {
    await handleCommand(COMMAND_TOGGLE_PANEL, {
      id: 5,
      windowId: 3,
    } as chrome.tabs.Tab)

    expect(toggleSidePanelMock).toHaveBeenCalledWith(3)
  })

  it('khong co tab → toggle khong windowId', async () => {
    await handleCommand(COMMAND_TOGGLE_PANEL)

    expect(toggleSidePanelMock).toHaveBeenCalledWith(undefined)
  })

  it('command la → bo qua', async () => {
    await handleCommand('sidekick-khong-ton-tai')

    expect(toggleSidePanelMock).not.toHaveBeenCalled()
  })

  it('id command khop manifest', () => {
    expect(COMMAND_TOGGLE_PANEL).toBe('sidekick-toggle-panel')
  })
})
