import { describe, expect, it } from 'vitest'
import { LIMITS } from '@sidekick/shared/constants'
import {
  isMeaningfulSelection,
  normalizeSelectionText,
  readSelectionFromDocument,
  selectionAnchorRect,
} from '../src/content/selection.js'

/**
 * Unit test cho `content/selection.ts` — doc/chuan hoa doan text user boi den
 * (T-M1-02, FR-CONTEXT-04).
 *
 * File nay thuan (khong dung `chrome.*`) → test duoc trong jsdom.
 * Docs: docs/SYSTEM_DESIGN.md §7.3.4
 */

/**
 * Tao mot `<p>` trong `document` chinh va boi den toan bo.
 *
 * LUU Y: jsdom chi ho tro `getSelection()` tren `document` chinh — tao
 * document bang `document.implementation.createHTMLDocument()` se tra `null`.
 *
 * @param text - Noi dung can boi den.
 */
function selectTextInMainDocument(text: string): void {
  const paragraph = document.createElement('p')
  paragraph.textContent = text
  document.body.appendChild(paragraph)

  const range = document.createRange()
  range.selectNodeContents(paragraph)

  const selection = document.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

/** Xoa noi dung + bo selection trong `document` chinh. */
function resetMainDocument(): void {
  document.getSelection()?.removeAllRanges()
  document.body.innerHTML = ''
}

describe('normalizeSelectionText', () => {
  it('gop khoang trang thua thanh 1 space', () => {
    expect(normalizeSelectionText('a   b\t\tc')).toBe('a b c')
  })

  it('doi non-breaking space thanh space thuong', () => {
    expect(normalizeSelectionText('a\u00a0b')).toBe('a b')
  })

  it('bo khoang trang dau/cuoi', () => {
    expect(normalizeSelectionText('   xin chao   ')).toBe('xin chao')
  })

  it('bo ký tự điều khiển', () => {
    expect(normalizeSelectionText('a\u0007b\u001fc')).toBe('a b c')
  })

  it('chuoi rong → chuoi rong', () => {
    expect(normalizeSelectionText('')).toBe('')
  })

  it('chi co khoang trang → chuoi rong', () => {
    expect(normalizeSelectionText('   \n\t  ')).toBe('')
  })

  it('cat tai gioi han MAX_SELECTION_CHARS', () => {
    const long = 'a'.repeat(LIMITS.MAX_SELECTION_CHARS + 500)

    const result = normalizeSelectionText(long)

    expect(result.length).toBeLessThanOrEqual(LIMITS.MAX_SELECTION_CHARS)
    expect(result.length).toBeGreaterThan(0)
  })

  it('cat tai ranh giới từ, không cắt giữa từ', () => {
    const long = `${'a'.repeat(LIMITS.MAX_SELECTION_CHARS)} tail`

    const result = normalizeSelectionText(long)

    expect(result.endsWith('tail')).toBe(false)
    expect(result).toBe('a'.repeat(LIMITS.MAX_SELECTION_CHARS))
  })

  it('KHÔNG cắt giữa surrogate pair (emoji)', () => {
    // Emoji chiem 2 code unit → cat o giua se tao U+FFFD.
    const emoji = '😀'.repeat(LIMITS.MAX_SELECTION_CHARS)
    const long = emoji + ' tail'

    const result = normalizeSelectionText(long)

    expect(result.includes('\uFFFD')).toBe(false)
    // Chuoi sau cat phai chi gom emoji hop le.
    expect([...result].every((char) => char === '😀')).toBe(true)
  })
})

describe('isMeaningfulSelection', () => {
  it('chuoi rong → false', () => {
    expect(isMeaningfulSelection('')).toBe(false)
  })

  it('chi khoang trang → false', () => {
    expect(isMeaningfulSelection('    ')).toBe(false)
  })

  it('ngắn hơn MIN_SELECTION_CHARS → false', () => {
    expect(isMeaningfulSelection('a'.repeat(LIMITS.MIN_SELECTION_CHARS - 1))).toBe(false)
  })

  it('bang MIN_SELECTION_CHARS → true', () => {
    expect(isMeaningfulSelection('a'.repeat(LIMITS.MIN_SELECTION_CHARS))).toBe(true)
  })

  it('dài hơn → true', () => {
    expect(isMeaningfulSelection('a'.repeat(LIMITS.MIN_SELECTION_CHARS + 1))).toBe(true)
  })
})

describe('readSelectionFromDocument', () => {
  it('doc duoc text da chuan hoa', () => {
    selectTextInMainDocument('Doan van duoc boi den tren trang web')

    const snapshot = readSelectionFromDocument(document)

    expect(snapshot?.text).toBe('Doan van duoc boi den tren trang web')
    resetMainDocument()
  })

  it('chuan hoa whitespace khi doc', () => {
    const paragraph = document.createElement('p')
    paragraph.textContent = 'Doan   van\u00a0co  khoang trang thua'
    document.body.appendChild(paragraph)

    const range = document.createRange()
    range.selectNodeContents(paragraph)
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    const snapshot = readSelectionFromDocument(document)

    expect(snapshot?.text).toBe('Doan van co khoang trang thua')
    resetMainDocument()
  })

  it('khong co selection → undefined', () => {
    document.getSelection()?.removeAllRanges()

    expect(readSelectionFromDocument(document)).toBeUndefined()
  })

  it('selection quá ngắn → undefined', () => {
    selectTextInMainDocument('ngan')

    expect(readSelectionFromDocument(document)).toBeUndefined()
    resetMainDocument()
  })

  it('selection rỗng (collapsed) → undefined', () => {
    const paragraph = document.createElement('p')
    paragraph.textContent = 'a'.repeat(50)
    document.body.appendChild(paragraph)

    const range = document.createRange()
    range.setStart(paragraph.firstChild as Node, 0)
    range.collapse(true)
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    expect(readSelectionFromDocument(document)).toBeUndefined()
    resetMainDocument()
  })
})

describe('selectionAnchorRect', () => {
  const viewport = { width: 1000, height: 800 }

  it('neo duoi vung chon khi du chua', () => {
    const anchor = selectionAnchorRect({ top: 100, left: 50, right: 200, bottom: 140 }, viewport)

    expect(anchor.placement).toBe('below')
    expect(anchor.top).toBeGreaterThan(140)
    expect(anchor.left).toBe(50)
  })

  it('chuyen sang tren khi tran canh duoi viewport', () => {
    const anchor = selectionAnchorRect({ top: 770, left: 50, right: 200, bottom: 795 }, viewport)

    expect(anchor.placement).toBe('above')
    expect(anchor.top).toBeLessThan(770)
  })

  it('clamp left khi tran canh phai', () => {
    const anchor = selectionAnchorRect({ top: 10, left: 990, right: 1000, bottom: 40 }, viewport)

    expect(anchor.left).toBeLessThanOrEqual(viewport.width)
    expect(anchor.left).toBeGreaterThanOrEqual(0)
  })

  it('clamp top khi am', () => {
    const anchor = selectionAnchorRect({ top: -50, left: 10, right: 20, bottom: -10 }, viewport)

    expect(anchor.top).toBe(0)
  })
})
