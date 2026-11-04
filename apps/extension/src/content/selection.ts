/**
 * Doc va chuan hoa vung text user boi den (selection context — T-M1-02).
 *
 * File nay **thuan**: khong dung `chrome.*`, khong mutate DOM → test duoc
 * trong jsdom. Content script va panel deu goi cung mot ham de khong lech
 * quy tac "doan duoc gui len BFF".
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.4
 */

import { LIMITS } from '@sidekick/shared/constants'

/**
 * Hinh chu nhat cua vung boi den (toa do viewport).
 *
 * Dung kieu rieng thay vi `DOMRect` de jsdom (khong co `DOMRect`) va de
 * vi duong `rect` duoc serialize qua `chrome.scripting.executeScript`.
 */
export interface SelectionRect {
  /** Canh tren (px, viewport). */
  top: number
  /** Canh trai (px, viewport). */
  left: number
  /** Canh phai (px, viewport). */
  right: number
  /** Canh duoi (px, viewport). */
  bottom: number
}

/** Kich thuoc khung nhin cua trang (px). */
export interface ViewportSize {
  width: number
  height: number
}

/** Ket qua doc selection. */
export interface SelectionSnapshot {
  /** Text da chuan hoa (khoang trang gop, da cat theo gioi han). */
  text: string
  /** Hinh chu nhat cua vung chon (neu khong doc duoc → `undefined`). */
  rect: SelectionRect | undefined
}

/** Vi tri neo cua nut nobi "Hoi Sidekick". */
export interface SelectionAnchor {
  /** Toa do `left` (px, viewport). */
  left: number
  /** Toa do `top` (px, viewport). */
  top: number
  /** Nut nam duoi hay tren vung chon. */
  placement: 'below' | 'above'
}

/** Kich thuoc uoc luong cua nut nobi (px) — dung de clamp trong viewport. */
const BUTTON_WIDTH = 132
const BUTTON_HEIGHT = 30

/** Khoang cach giữa vung chon va nut (px). */
const ANCHOR_GAP = 6

/**
 * Chuan hoa text boi den.
 *
 * - `&nbsp;` → space thuong.
 * - Gop khoang trang thua (space, tab, newline) → 1 space.
 * - Bo ký tu dieu khien (trừ `\n` trong text da ghep).
 * - Cat tai `LIMITS.MAX_SELECTION_CHARS` tai ranh giới tu, khong cat giua
 *   surrogate pair (ky tu emoji).
 *
 * @param raw - Text tho tu `Selection.toString()`.
 */
export function normalizeSelectionText(raw: string): string {
  if (raw.length === 0) return ''

  const cleaned = raw
    // Ky tu dieu khien (khong giu tab/newline — se gop thanh space).
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (cleaned.length <= LIMITS.MAX_SELECTION_CHARS) return cleaned

  const slice = cleaned.slice(0, LIMITS.MAX_SELECTION_CHARS)
  const lastSpace = slice.lastIndexOf(' ')
  const safe = lastSpace > LIMITS.MAX_SELECTION_CHARS * 0.6 ? slice.slice(0, lastSpace) : slice

  return trimSurrogate(safe).trimEnd()
}

/**
 * Cat chuoi nhung khong cat giua surrogate pair.
 *
 * Emoji (vd `😀`) la 2 code unit trong JS → cat o giua se tao ra
 * `U+FFFD` khi render.
 */
function trimSurrogate(text: string): string {
  const lastCode = text.charCodeAt(text.length - 1)
  // High surrogate nằm trong khoang 0xD800–0xDBFF.
  if (lastCode >= 0xd800 && lastCode <= 0xdbff) {
    return text.slice(0, text.length - 1)
  }
  return text
}

/**
 * Doan boi den co y nghia khong.
 *
 * Ngan hon `LIMITS.MIN_SELECTION_CHARS` → co the la rac (click chuot hay
 * keo 1-2 ky tu) → khong tao context item.
 *
 * @param text - Text da chuan hoa.
 */
export function isMeaningfulSelection(text: string): boolean {
  return text.trim().length >= LIMITS.MIN_SELECTION_CHARS
}

/**
 * Doc selection hien tai cua mot document.
 *
 * - Khong co selection / `rangeCount === 0` → `undefined`.
 * - Selection quá ngắn → `undefined`.
 * - Không bao gio throw.
 *
 * @param doc - Document can doc (mac dinh `document`).
 */
export function readSelectionFromDocument(doc: Document = document): SelectionSnapshot | undefined {
  const selection = doc.getSelection()
  if (selection === null) return undefined
  if (selection.rangeCount === 0) return undefined

  const text = normalizeSelectionText(selection.toString())
  if (!isMeaningfulSelection(text)) return undefined

  return { text, rect: readRangeRect(selection) }
}

/**
 * Doc hinh chu nhat cua vung chon hien tai.
 *
 * `getBoundingClientRect()` tra gia tri 0 trong jsdom va tren mot so trang
 * khong layout → tra `undefined` de caller bo qua toa do neo.
 */
function readRangeRect(selection: Selection): SelectionRect | undefined {
  try {
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    const top = Number(rect.top)
    const left = Number(rect.left)
    const bottom = Number(rect.bottom)
    const right = Number(rect.right)

    if (!Number.isFinite(top) || !Number.isFinite(left)) return undefined

    return { top, left, bottom, right }
  } catch {
    return undefined
  }
}

/**
 * Tinh vi tri neo cho nut nobi "Hoi Sidekick".
 *
 * Uu tien dat **duoi** vung chon (doc lap), neu tran canh duoi viewport →
 * dat **tren**. Toa do `left` luon clamp de nut khong tran canh phai.
 *
 * @param rect - Hinh chu nhat vung chon.
 * @param viewport - Kich thuoc khung nhin.
 */
export function selectionAnchorRect(rect: SelectionRect, viewport: ViewportSize): SelectionAnchor {
  const below = rect.bottom + ANCHOR_GAP
  const above = rect.top - BUTTON_HEIGHT - ANCHOR_GAP

  // Tran canh duoi → dat len tren.
  const placement: 'below' | 'above' = below + BUTTON_HEIGHT > viewport.height ? 'above' : 'below'
  const rawTop = placement === 'below' ? below : above

  const maxLeft = Math.max(0, viewport.width - BUTTON_WIDTH)
  const left = Math.min(Math.max(0, rect.left), maxLeft)

  // `top` co the am (vung chon o tren man hinh) → clamp ve 0.
  const top = Math.max(0, rawTop)

  return { left, top, placement }
}
