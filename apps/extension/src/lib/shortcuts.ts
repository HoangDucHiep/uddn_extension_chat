import type { TranslationKey } from '@/i18n'

/**
 * Logic phim tat (FR-UX-01 — T-M1-18).
 *
 * File nay **thuan** (khong dung `chrome.*`) de test duoc trong jsdom.
 *
 * ## Gioi han cua Chrome (quan trong)
 *
 * Chrome chi expose `chrome.commands.getAll()` + `chrome.commands.onCommand`.
 * `chrome.commands.update()` / `chrome.commands.reset()` **khong ton tai** —
 * do la API cua **Firefox** rieng. Chrome chi cho user doi shortcut tai
 * `chrome://extensions/shortcuts`.
 *
 * => Shortcut **tu do cua Sidekick** duoc luu trong `chrome.storage.local`
 * (xem `lib/shortcutStorage.ts`) va duoc **bat o content script** + **side
 * panel** (xem `content/shortcutListener.ts`). Shortcut **native cua Chrome**
 * (`sidekick-toggle-panel`) van giu nguyen de user doi o trang cai dat
 * cua trinh duyet.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.18
 */

/**
 * Danh sach command **native** cua extension.
 *
 * Key = id command trong `manifest.json` (`commands`).
 * Value = key i18n cua nhan hien thi.
 */
export const SHORTCUT_COMMANDS = {
  'sidekick-toggle-panel': 'settings.shortcuts.command.togglePanel',
} as const satisfies Record<string, TranslationKey>

/** Id cua command toggle panel (native cua Chrome). */
export const TOGGLE_PANEL_COMMAND = 'sidekick-toggle-panel'

/** Id cua command toggle panel (re-export de vi tri khac dung). */
export type ShortcutCommandId = keyof typeof SHORTCUT_COMMANDS

/**
 * Shortcut mac dinh cua tung command — **phai khop `suggested_key`** trong
 * `public/manifest.json`.
 *
 * Chi dung lam **fallback** khi user chua dat shortcut tu do.
 */
export const DEFAULT_SHORTCUTS: Record<string, string> = {
  [TOGGLE_PANEL_COMMAND]: 'Ctrl+Shift+K',
}

/**
 * To hop phim **danh rieng** cua Chrome / Windows / macOS.
 *
 * Chrome khong cho extension truy xuat danh sach shortcut mac dinh cua
 * trinh duyet → phai **deny-list** thu cong de chan trung.
 *
 * Chi ghi nhung to hop gan nhat voi thao tac trinh duyet; nhung to hop
 * it gap nhung van la "shortcut he thong" nen cung chan.
 */
export const RESERVED_CHROME_SHORTCUTS: readonly string[] = [
  'Ctrl+T',
  'Ctrl+N',
  'Ctrl+W',
  'Ctrl+Shift+N',
  'Ctrl+Shift+T',
  'Ctrl+Shift+W',
  'Ctrl+Shift+Q',
  'F5',
  'Ctrl+Shift+Delete',
  'Ctrl+L',
  'Ctrl+D',
  'Ctrl+P',
  'Ctrl+S',
  'Ctrl+O',
  'Alt+F4',
  'F11',
  'F12',
  'Ctrl+Tab',
  'Ctrl+Shift+Tab',
  'Ctrl+1',
  'Ctrl+2',
  'Ctrl+3',
  'Ctrl+4',
  'Ctrl+5',
  'Ctrl+6',
  'Ctrl+7',
  'Ctrl+8',
  'Ctrl+9',
]

/** Thu tu modifier chuan hoa (khop thu tu hien thi cua Chrome). */
const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const

/** Ten modifier ma Chrome chap nhan (khop `chrome.commands` docs). */
const MODIFIER_ALIASES: Readonly<Record<string, string>> = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  ctl: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  opt: 'Alt',
  shift: 'Shift',
  meta: 'Meta',
  cmd: 'Meta',
  command: 'Meta',
  super: 'Meta',
  win: 'Meta',
}

/** Ten phim duoc phep (chu, so, F1-F12, phim chuc nang). */
const KEY_PATTERN =
  /^(?:[a-z0-9]|f(?:[1-9]|1[0-2])|(?:comma|period|semicolon|slash|backslash|quote|bracketleft|bracketright|minus|equal|backspace|delete|insert|home|end|pageup|pagedown|up|down|left|right|space|enter|tab|escape))$/

/** Ket qua phan tich 1 to hop phim. */
export type ShortcutParseResult =
  | { ok: true; shortcut: string }
  | { ok: false; reason: 'invalid' | 'reserved' }

/**
 * Chuẩn hoá 1 to hop phim.
 *
 * `"ctrl+shift+k"` → `"Ctrl+Shift+K"`. Thu tu modifier luon la
 * Ctrl → Alt → Shift → Meta, phim dat cuoi.
 *
 * @param input - Chuoi nguoi dung nhap (co the viet tuong doi).
 * @returns Chuoi chuan hoa, hoac `undefined` neu khong hop le.
 */
export function normalizeShortcut(input: string): string | undefined {
  const parts = input
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  if (parts.length === 0) return undefined

  const modifiers: string[] = []
  let key: string | undefined

  for (const part of parts) {
    const alias = MODIFIER_ALIASES[part.toLowerCase()]
    if (alias !== undefined) {
      // Trung modifier → bo qua (khong loi).
      if (!modifiers.includes(alias)) modifiers.push(alias)
      continue
    }

    // Chi cho phep 1 phim chinh.
    if (key !== undefined) return undefined

    const lower = part.toLowerCase()
    if (!KEY_PATTERN.test(lower)) return undefined

    key = lower === 'space' ? 'Space' : lower === 'enter' ? 'Enter' : upperFirst(lower)
  }

  if (key === undefined) return undefined

  const sortedModifiers = MODIFIER_ORDER.filter((modifier) => modifiers.includes(modifier))

  return [...sortedModifiers, key].join('+')
}

/**
 * To hop phim nay co thuoc ve trinh duyet khong?
 *
 * @param shortcut - To hop da chuan hoa (hoac chua, deu an toan).
 * @returns `true` neu bi Chrome danh rieng.
 */
export function isReservedShortcut(shortcut: string): boolean {
  const normalized = normalizeShortcut(shortcut)
  if (normalized === undefined) return false

  return RESERVED_CHROME_SHORTCUTS.some((reserved) => {
    return normalizeShortcut(reserved) === normalized
  })
}

/**
 * Phan tich 1 to hop phim do nguoi dung nhap.
 *
 * @param input - Chuoi nguoi dung nhap.
 * @returns `{ ok: true, shortcut }` neu hop le va khong bi danh rieng;
 *   `{ ok: false, reason: 'invalid' | 'reserved' }` neu khong.
 */
export function parseShortcut(input: string): ShortcutParseResult {
  const normalized = normalizeShortcut(input)
  if (normalized === undefined) return { ok: false, reason: 'invalid' }
  if (isReservedShortcut(normalized)) return { ok: false, reason: 'reserved' }

  return { ok: true, shortcut: normalized }
}

/**
 * Chuyen 1 `KeyboardEvent` thanh chuoi to hop phim theo format Chrome.
 *
 * Dung khi user bam phim trong o "Doi" → ta nhan truc tiep thay vi phai
 * go tay (go tay de bi sai dau).
 *
 * @param event - Su kien ban phim.
 * @returns Chuoi to hop phim, hoac `undefined` neu khong the.
 */
export function shortcutFromKeyboardEvent(event: KeyboardEvent): string | undefined {
  const key = event.key

  if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') return undefined
  if (key === 'Escape') return 'Escape'

  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (event.metaKey) parts.push('Meta')

  parts.push(key)

  return normalizeShortcut(parts.join('+'))
}

/**
 * Kiem tra 1 su kien ban phim co khop 1 to hop da luu hay khong.
 *
 * @param event - Su kien ban phim can kiem tra.
 * @param shortcut - To hop da luu (chua chuan hoa van duoc chuan hoa lai).
 * @returns `true` neu khop.
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const expected = normalizeShortcut(shortcut)
  if (expected === undefined) return false

  const actual = shortcutFromKeyboardEvent(event)
  if (actual === undefined) return false

  return actual === expected
}

/**
 * Chuoi hien thi cua 1 to hop phim (dung cho UI).
 *
 * @param shortcut - To hop da chuan hoa (co the rong).
 * @returns Chuoi hien thi, hoac `undefined` neu chua gan shortcut.
 */
export function formatShortcutLabel(shortcut: string | undefined): string | undefined {
  if (shortcut === undefined || shortcut.trim().length === 0) return undefined
  return shortcut
}

/**
 * Viet hoa chu cai dau tien.
 *
 * @param value - Chuoi can chuan hoa.
 * @returns Chuoi da viet hoa chu cai dau.
 */
function upperFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
