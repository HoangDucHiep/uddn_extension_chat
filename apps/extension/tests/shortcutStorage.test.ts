import { beforeEach, describe, expect, it } from 'vitest'
import {
  SHORTCUTS_STORAGE_KEY,
  clearShortcut,
  readShortcuts,
  resolveShortcut,
  writeShortcut,
} from '@/lib/shortcutStorage'
import { TOGGLE_PANEL_COMMAND } from '@/lib/shortcuts'

/**
 * Unit test luu shortcut tu do (T-M1-18, FR-UX-01).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.18
 */
describe('shortcutStorage', () => {
  beforeEach(async () => {
    await chrome.storage.local.remove(SHORTCUTS_STORAGE_KEY)
  })

  it('chua luu gi → readShortcuts tra undefined', async () => {
    expect(await readShortcuts()).toBeUndefined()
  })

  it('ghi 1 shortcut → doc lai duoc', async () => {
    await writeShortcut(TOGGLE_PANEL_COMMAND, 'Alt+Shift+S')

    const stored = await readShortcuts()
    expect(stored?.[TOGGLE_PANEL_COMMAND]).toBe('Alt+Shift+S')
  })

  it('ghi nhieu lan → ghi de, khong nhan ban', async () => {
    await writeShortcut(TOGGLE_PANEL_COMMAND, 'Alt+Shift+S')
    await writeShortcut(TOGGLE_PANEL_COMMAND, 'Ctrl+Shift+M')

    const stored = await readShortcuts()
    expect(stored?.[TOGGLE_PANEL_COMMAND]).toBe('Ctrl+Shift+M')
  })

  it('xoa shortcut cuoi cung → xoa ca khoa storage', async () => {
    await writeShortcut(TOGGLE_PANEL_COMMAND, 'Alt+Shift+S')
    await clearShortcut(TOGGLE_PANEL_COMMAND)

    const raw = await chrome.storage.local.get(SHORTCUTS_STORAGE_KEY)
    expect(raw[SHORTCUTS_STORAGE_KEY]).toBeUndefined()
    expect(await readShortcuts()).toBeUndefined()
  })

  it('resolveShortcut: uu tien shortcut tu do, fallback mac dinh', () => {
    expect(resolveShortcut(TOGGLE_PANEL_COMMAND, undefined)).toBe('Ctrl+Shift+K')
    expect(resolveShortcut(TOGGLE_PANEL_COMMAND, {})).toBe('Ctrl+Shift+K')
    expect(
      resolveShortcut(TOGGLE_PANEL_COMMAND, { [TOGGLE_PANEL_COMMAND]: 'Alt+Shift+S' }),
    ).toBe('Alt+Shift+S')
  })

  it('resolveShortcut: shortcut rong trong map → fallback mac dinh', () => {
    expect(resolveShortcut(TOGGLE_PANEL_COMMAND, { [TOGGLE_PANEL_COMMAND]: '' })).toBe(
      'Ctrl+Shift+K',
    )
  })
})
