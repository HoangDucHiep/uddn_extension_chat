import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ShortcutsSettings } from '../src/sidepanel/components/settings/ShortcutsSettings'
import { commandsGetAllMock } from './setup.js'

/**
 * Unit test section phim tat (FR-UX-01 — T-M1-18).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.18
 */

/** Id cua command toggle panel. */
const TOGGLE_COMMAND = 'sidekick-toggle-panel'

/** Khoa storage luu shortcut tu do. */
const SHORTCUTS_STORAGE_KEY = 'sidekick.shortcuts'

describe('ShortcutsSettings', () => {
  beforeEach(async () => {
    commandsGetAllMock.mockClear()
    // Storage dung chung giua cac test → xoa shortcut tu do truoc moi test.
    await chrome.storage.local.remove(SHORTCUTS_STORAGE_KEY)
  })

  it('doc shortcut native cua Chrome tu chrome.commands.getAll()', async () => {
    render(<ShortcutsSettings />)

    await waitFor(() => {
      expect(screen.getByTestId(`shortcut-native-${TOGGLE_COMMAND}`)).toBeDefined()
    })

    expect(screen.getByTestId(`shortcut-native-${TOGGLE_COMMAND}`).textContent).toBe(
      'Ctrl+Shift+K',
    )
    expect(commandsGetAllMock).toHaveBeenCalled()
  })

  it('bam "Đổi" → bam to hop phim → luu shortcut vao storage', async () => {
    render(<ShortcutsSettings />)

    await waitFor(() => {
      expect(screen.getByTestId(`shortcut-change-${TOGGLE_COMMAND}`)).toBeDefined()
    })

    fireEvent.click(screen.getByTestId(`shortcut-change-${TOGGLE_COMMAND}`))

    await waitFor(() => {
      expect(screen.getByTestId(`shortcut-capture-${TOGGLE_COMMAND}`)).toBeDefined()
    })

    fireEvent.keyDown(screen.getByTestId(`shortcut-capture-${TOGGLE_COMMAND}`), {
      key: 's',
      altKey: true,
      shiftKey: true,
    })

    await waitFor(() => {
      expect(screen.getByTestId(`shortcut-quick-${TOGGLE_COMMAND}`).textContent).toBe(
        'Alt+Shift+S',
      )
    })

    const stored = await chrome.storage.local.get(SHORTCUTS_STORAGE_KEY)
    expect((stored[SHORTCUTS_STORAGE_KEY] as Record<string, string>)[TOGGLE_COMMAND]).toBe(
      'Alt+Shift+S',
    )
  })

  it('to hop phim bi trinh duyet danh riêng → hien loi, khong luu', async () => {
    render(<ShortcutsSettings />)

    await waitFor(() => {
      expect(screen.getByTestId(`shortcut-change-${TOGGLE_COMMAND}`)).toBeDefined()
    })

    fireEvent.click(screen.getByTestId(`shortcut-change-${TOGGLE_COMMAND}`))

    await waitFor(() => {
      expect(screen.getByTestId(`shortcut-capture-${TOGGLE_COMMAND}`)).toBeDefined()
    })

    fireEvent.keyDown(screen.getByTestId(`shortcut-capture-${TOGGLE_COMMAND}`), {
      key: 't',
      ctrlKey: true,
    })

    await waitFor(() => {
      expect(screen.getByTestId('shortcut-error')).toBeDefined()
    })

    const stored = await chrome.storage.local.get(SHORTCUTS_STORAGE_KEY)
    expect(stored[SHORTCUTS_STORAGE_KEY]).toBeUndefined()
  })

  it('bam "Về mặc định" → xoa shortcut tu do khoi storage', async () => {
    // Seed shortcut tu do truoc.
    await chrome.storage.local.set({
      [SHORTCUTS_STORAGE_KEY]: { [TOGGLE_COMMAND]: 'Alt+Shift+S' },
    })

    render(<ShortcutsSettings />)

    await waitFor(() => {
      expect(screen.getByTestId(`shortcut-quick-${TOGGLE_COMMAND}`).textContent).toBe(
        'Alt+Shift+S',
      )
    })

    fireEvent.click(screen.getByTestId(`shortcut-reset-${TOGGLE_COMMAND}`))

    await waitFor(() => {
      expect(screen.getByTestId(`shortcut-quick-${TOGGLE_COMMAND}`).textContent).toBe(
        'Ctrl+Shift+K',
      )
    })

    const stored = await chrome.storage.local.get(SHORTCUTS_STORAGE_KEY)
    expect(stored[SHORTCUTS_STORAGE_KEY]).toBeUndefined()
  })

  it('nut "Về mặc định" bị disable khi chua dat shortcut tu do', async () => {
    render(<ShortcutsSettings />)

    await waitFor(() => {
      expect(screen.getByTestId(`shortcut-reset-${TOGGLE_COMMAND}`)).toBeDefined()
    })

    const resetButton = screen.getByTestId(`shortcut-reset-${TOGGLE_COMMAND}`)
    expect((resetButton as HTMLButtonElement).disabled).toBe(true)
  })
})
