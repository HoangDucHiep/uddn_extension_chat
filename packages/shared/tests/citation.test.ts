import { describe, expect, it } from 'vitest'
import {
  CITATION_INSTRUCTION,
  CITATION_MARKER_PATTERN,
  parseCitationMarkers,
} from '../src/citation.js'

/**
 * Test hop dong trich dan (FR-CONTEXT-10 — T-M1-08).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.9
 */

describe('parseCitationMarkers', () => {
  it('lay cac so nguon xuat hien trong text', () => {
    expect(parseCitationMarkers('Gia do la 30% [1] va [2]')).toEqual([1, 2])
  })

  it('loai bo marker trung lap', () => {
    expect(parseCitationMarkers('[1] ... [1] ... [1]')).toEqual([1])
  })

  it('sap xep tang dan (khong phu thuoc thu tu model sinh)', () => {
    expect(parseCitationMarkers('[3] va [1] va [2]')).toEqual([1, 2, 3])
  })

  it('bo qua marker khong phai so', () => {
    expect(parseCitationMarkers('Xem [abc] va [note]')).toEqual([])
  })

  it('bo qua so > 2 chu so', () => {
    expect(parseCitationMarkers('So [123] khong phai marker')).toEqual([])
  })

  it('bo qua so 0', () => {
    expect(parseCitationMarkers('[0] khong phai nguon')).toEqual([])
  })

  it('text rong → mang rong', () => {
    expect(parseCitationMarkers('')).toEqual([])
  })

  it('khong mutate lastIndex cua regex hang (an toan ham thuan)', () => {
    const before = CITATION_MARKER_PATTERN.lastIndex

    parseCitationMarkers('[1] [2]')
    parseCitationMarkers('[3]')

    expect(CITATION_MARKER_PATTERN.lastIndex).toBe(before)
  })

  it('goi lap nhieu lan cho cung ket qua (khong state giua cac lan)', () => {
    const first = parseCitationMarkers('a [1] b [2]')
    const second = parseCitationMarkers('a [1] b [2]')

    expect(first).toEqual(second)
  })

  it('bat marker lien nhau khong nhat', () => {
    expect(parseCitationMarkers('gia do [1][2]')).toEqual([1, 2])
  })
})

describe('CITATION_INSTRUCTION', () => {
  it('nho model chi dan so nguon', () => {
    expect(CITATION_INSTRUCTION).toContain('[1]')
  })

  it('chi dan dung cac nguon da cung cap', () => {
    expect(CITATION_INSTRUCTION.toLowerCase()).toContain('đã được cung cấp')
  })
})
