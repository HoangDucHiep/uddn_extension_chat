import { describe, expect, it, vi } from 'vitest'
import { createSelectionWatcher } from '../src/content/selectionWatcher.js'
import type { SelectionButtonHandle } from '../src/content/selectionButton.js'

/**
 * Unit test cho `content/selectionWatcher.ts` — theo doi selection + hien/an
 * nut nobi (T-M1-02).
 * Docs: docs/SYSTEM_DESIGN.md §7.3.4
 */

/** Nut nobi gia lap — chi ghi lai cac lenh. */
function fakeButton(): SelectionButtonHandle & { shown: number; hidden: number } {
  let shown = 0
  let hidden = 0

  return {
    show: () => {
      shown += 1
    },
    hide: () => {
      hidden += 1
    },
    destroy: () => undefined,
    get shown() {
      return shown
    },
    get hidden() {
      return hidden
    },
  }
}

/**
 * Tao mot `<p>` trong `document` chinh va boi den toan bo.
 *
 * LUU Y: jsdom chi ho tro `getSelection()` tren `document` chinh.
 *
 * @param text - Noi dung can boi den.
 */
function selectTextInMainDocument(text: string): void {
  document.body.innerHTML = ''
  const paragraph = document.createElement('p')
  paragraph.textContent = text
  document.body.appendChild(paragraph)

  const range = document.createRange()
  range.selectNodeContents(paragraph)

  const selection = document.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

/** Xoa selection trong `document` chinh. */
function clearSelection(): void {
  document.getSelection()?.removeAllRanges()
}

describe('createSelectionWatcher', () => {
  it('KHONG hien nut khi khong co selection', () => {
    clearSelection()
    const button = fakeButton()
    const watcher = createSelectionWatcher({ button, doc: document, debounceMs: 0 })
    watcher.start()

    watcher.refresh()

    expect(button.shown).toBe(0)
    watcher.stop()
  })

  it('hien nut khi selection du toi da', () => {
    selectTextInMainDocument('Doan van ban duoc boi den tren trang web')
    const button = fakeButton()
    const watcher = createSelectionWatcher({ button, doc: document, debounceMs: 0 })
    watcher.start()

    watcher.refresh()

    expect(button.shown).toBe(1)
    watcher.stop()
  })

  it('KHONG hien nut khi selection qua ngan', () => {
    selectTextInMainDocument('ngan')
    const button = fakeButton()
    const watcher = createSelectionWatcher({ button, doc: document, debounceMs: 0 })
    watcher.start()

    watcher.refresh()

    expect(button.shown).toBe(0)
    watcher.stop()
  })

  it('an nut khi selection bi thu hoi', () => {
    selectTextInMainDocument('Doan van ban duoc boi den tren trang web')
    const button = fakeButton()
    const watcher = createSelectionWatcher({ button, doc: document, debounceMs: 0 })
    watcher.start()
    watcher.refresh()
    expect(button.shown).toBe(1)

    clearSelection()
    document.dispatchEvent(new Event('selectionchange'))

    expect(button.hidden).toBeGreaterThan(0)
    watcher.stop()
  })

  it('KHONG hien nut lai khi selection khong doi', () => {
    selectTextInMainDocument('Doan van ban duoc boi den tren trang web')
    const button = fakeButton()
    const watcher = createSelectionWatcher({ button, doc: document, debounceMs: 0 })
    watcher.start()

    watcher.refresh()
    watcher.refresh()

    expect(button.shown).toBe(1)
    watcher.stop()
  })

  it('an nut khi trang scroll (toan do vung chon doi)', () => {
    selectTextInMainDocument('Doan van ban duoc boi den tren trang web')
    const button = fakeButton()
    const watcher = createSelectionWatcher({ button, doc: document, debounceMs: 0 })
    watcher.start()
    watcher.refresh()

    window.dispatchEvent(new Event('scroll'))

    expect(button.hidden).toBeGreaterThan(0)
    watcher.stop()
  })

  it('mouseup → debounce → refresh', async () => {
    vi.useFakeTimers()
    selectTextInMainDocument('Doan van ban duoc boi den tren trang web')
    const button = fakeButton()
    const watcher = createSelectionWatcher({ button, doc: document, debounceMs: 120 })
    watcher.start()

    document.dispatchEvent(new MouseEvent('mouseup'))
    // Chua qua debounce → chua hien nut.
    expect(button.shown).toBe(0)

    vi.advanceTimersByTime(200)

    expect(button.shown).toBe(1)
    vi.useRealTimers()
    watcher.stop()
  })

  it('stop() an nut va go listener', () => {
    selectTextInMainDocument('Doan van ban duoc boi den tren trang web')
    const button = fakeButton()
    const watcher = createSelectionWatcher({ button, doc: document, debounceMs: 0 })
    watcher.start()
    watcher.refresh()

    watcher.stop()

    expect(button.hidden).toBeGreaterThan(0)
  })
})
