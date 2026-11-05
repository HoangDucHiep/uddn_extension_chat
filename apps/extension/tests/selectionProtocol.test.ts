import { describe, expect, it } from 'vitest'
import {
  SELECTION_ACTION,
  SELECTION_EMPTY_ERROR_CODE,
  isSelectionMessage,
  selectionItemId,
} from '../src/lib/selectionProtocol.js'

/**
 * Unit test cho `lib/selectionProtocol.ts` — hop dong selection giữa content
 * script → service worker → panel (T-M1-02).
 * Docs: docs/SYSTEM_DESIGN.md §7.3.4
 */

/** Payload hop le. */
const validPayload = {
  id: 'selection-abc',
  text: 'Doan van ban da boi den',
  url: 'https://example.com/',
  title: 'Bai viet mau',
  tabId: 42,
  createdAt: 1_700_000_000_000,
}

describe('isSelectionMessage', () => {
  it('nhan message dung shape', () => {
    expect(
      isSelectionMessage({ action: SELECTION_ACTION, payload: validPayload }),
    ).toBe(true)
  })

  it('tu choi action khac', () => {
    expect(
      isSelectionMessage({ action: 'sidekick:extract-content', payload: validPayload }),
    ).toBe(false)
  })

  it('tu choi payload thieu field', () => {
    const { text: _text, ...missing } = validPayload

    expect(isSelectionMessage({ action: SELECTION_ACTION, payload: missing })).toBe(false)
  })

  it('tu choi payload khong phai object', () => {
    expect(isSelectionMessage({ action: SELECTION_ACTION, payload: 'x' })).toBe(false)
    expect(isSelectionMessage({ action: SELECTION_ACTION })).toBe(false)
  })

  it('tu choi gia tri sai kieu', () => {
    expect(
      isSelectionMessage({
        action: SELECTION_ACTION,
        payload: { ...validPayload, createdAt: 'now' },
      }),
    ).toBe(false)
    expect(
      isSelectionMessage({
        action: SELECTION_ACTION,
        payload: { ...validPayload, text: 123 },
      }),
    ).toBe(false)
  })

  it('tu choi gia tri khong phai object', () => {
    expect(isSelectionMessage(null)).toBe(false)
    expect(isSelectionMessage(undefined)).toBe(false)
    expect(isSelectionMessage('string')).toBe(false)
    expect(isSelectionMessage(42)).toBe(false)
  })

  it('tu choi createdAt khong phai so huu han', () => {
    expect(
      isSelectionMessage({
        action: SELECTION_ACTION,
        payload: { ...validPayload, createdAt: Number.NaN },
      }),
    ).toBe(false)
  })
})

describe('selectionItemId', () => {
  it('cung noi dung → cung id (on dinh)', () => {
    expect(selectionItemId('doan van ban')).toBe(selectionItemId('doan van ban'))
  })

  it('noi dung khac → id khac', () => {
    expect(selectionItemId('doan 1')).not.toBe(selectionItemId('doan 2'))
  })

  it('id co tien to "selection-"', () => {
    expect(selectionItemId('x')).toMatch(/^selection-[0-9a-f]+$/)
  })

  it('khong rong → id khong rong', () => {
    expect(selectionItemId('a').length).toBeGreaterThan('selection-'.length)
  })
})

describe('constants', () => {
  it('action va error code la hang chuoi dinh', () => {
    expect(SELECTION_ACTION).toBe('sidekick:selection')
    expect(SELECTION_EMPTY_ERROR_CODE).toBe('CONTEXT_SELECTION_EMPTY')
  })
})
