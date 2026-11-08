import { DEFAULT_SHORTCUTS, SHORTCUT_COMMANDS } from './shortcuts'

/**
 * Luu shortcut **tu do** cua nguoi dung (FR-UX-01 — T-M1-18).
 *
 * ## Vi sao khong dung `chrome.commands.update()`?
 *
 * `chrome.commands` cua **Chrome chi** co `getAll()` + `onCommand`.
 * `update()` / `reset()` la API rieng cua **Firefox** → trong Chrome bi
 * `undefined`. Shortcut cua Chrome chi doi duoc o
 * `chrome://extensions/shortcuts` (ngoai tay user).
 *
 * => Sidekick tu lam 1 shortcut **rieng**:
 * - Luu trong `chrome.storage.local` (key `sidekick.shortcuts`).
 * - Content script + side panel lang nghe `keydown` → khop shortcut → mo panel.
 *
 * Shortcut **native** cua Chrome (`sidekick-toggle-panel`) van giu nguyen →
 * user van co the doi o trang cai dat cua trinh duyet.
 *
 * File nay **thuan** (chi dung `chrome.storage.local`) de test duoc trong jsdom.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.18
 */

/** Khoa luu shortcut tu do. */
export const SHORTCUTS_STORAGE_KEY = 'sidekick.shortcuts'

/** Shortcut da luu cho 1 command. */
export type ShortcutMap = Record<string, string>

/**
 * Doc shortcut tu do dang luu.
 *
 * Storage loi / gia tri sai → tra `undefined` (khong throw).
 *
 * @returns Map command → shortcut, hoac `undefined` neu chua co gi.
 */
export async function readShortcuts(): Promise<ShortcutMap | undefined> {
  try {
    const stored = await chrome.storage.local.get(SHORTCUTS_STORAGE_KEY)
    const value = stored[SHORTCUTS_STORAGE_KEY]
    if (typeof value !== 'object' || value === null) return undefined

    const record = value as Record<string, unknown>
    const result: ShortcutMap = {}
    for (const name of Object.keys(SHORTCUT_COMMANDS)) {
      const shortcut = record[name]
      if (typeof shortcut === 'string' && shortcut.length > 0) {
        result[name] = shortcut
      }
    }

    return Object.keys(result).length > 0 ? result : undefined
  } catch {
    return undefined
  }
}

/**
 * Ghi 1 shortcut tu do cho 1 command.
 *
 * @param name - Id cua command.
 * @param shortcut - To hop phim (da chuan hoa).
 */
export async function writeShortcut(name: string, shortcut: string): Promise<void> {
  try {
    const current = (await readShortcuts()) ?? {}
    await chrome.storage.local.set({
      [SHORTCUTS_STORAGE_KEY]: { ...current, [name]: shortcut },
    })
  } catch {
    // Storage khong ghi duoc → bo qua.
  }
}

/**
 * Xoa shortcut tu do cua 1 command → quay ve mac dinh.
 *
 * @param name - Id cua command.
 */
export async function clearShortcut(name: string): Promise<void> {
  try {
    const current = (await readShortcuts()) ?? {}
    const next = { ...current }
    delete next[name]

    if (Object.keys(next).length === 0) {
      await chrome.storage.local.remove(SHORTCUTS_STORAGE_KEY)
      return
    }

    await chrome.storage.local.set({ [SHORTCUTS_STORAGE_KEY]: next })
  } catch {
    // Bo qua.
  }
}

/**
 * Shortcut hieu luc cua 1 command.
 *
 * Uu tien shortcut **tu do** → fallback shortcut mac dinh.
 *
 * @param name - Id cua command.
 * @param shortcuts - Map shortcut da luu (neu co).
 * @returns To hop phim hieu luc.
 */
export function resolveShortcut(
  name: string,
  shortcuts: ShortcutMap | undefined,
): string | undefined {
  const custom = shortcuts?.[name]
  if (custom !== undefined && custom.length > 0) return custom

  return DEFAULT_SHORTCUTS[name]
}
