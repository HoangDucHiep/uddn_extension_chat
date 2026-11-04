/**
 * Unit test cho nhanh chon cach trich xuat context (T-M1-21 / T-M1-22).
 *
 * `detectPageKind` nam trong `packages/shared` (dung chung extension ↔ server),
 * nhung o day ta kiem tra **quyet dinh phia client**: nhanh `html` dung content
 * script, nhanh `pdf` / `youtube` phai doi goi BFF.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.1
 */

import { describe, expect, it } from 'vitest'
import { detectPageKind } from '@sidekick/shared'

describe('detectPageKind — quyet dinh phia client', () => {
  it('trang HTML → nhanh content script', () => {
    expect(detectPageKind('https://example.com/bai-viet')).toBe('html')
  })

  it('file PDF → nhanh BFF', () => {
    expect(detectPageKind('https://example.com/tai-lieu.pdf')).toBe('pdf')
  })

  it('video YouTube → nhanh BFF', () => {
    expect(detectPageKind('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube')
  })

  it('trang dac biet → bo qua, khong goi BFF', () => {
    expect(detectPageKind('chrome://extensions')).toBe('unknown')
    expect(detectPageKind('file:///C:/tai-lieu.pdf')).toBe('unknown')
  })
})
