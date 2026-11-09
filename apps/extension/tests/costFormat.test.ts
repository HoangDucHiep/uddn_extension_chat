import { describe, it, expect } from 'vitest'
import { formatCostUsd } from '../src/lib/costFormat'

/**
 * Unit test cho dinh dang chi phi USD (T-M2-03 — FR-PROVIDER-05).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.23
 */

describe('formatCostUsd', () => {
  it('tra chuoi rong khi chi phi bang 0', () => {
    expect(formatCostUsd(0)).toBe('')
  })

  it('tra chuoi rong khi chi phi undefined', () => {
    expect(formatCostUsd(undefined)).toBe('')
  })

  it('tra chuoi rong khi chi phi khong phai so han', () => {
    expect(formatCostUsd(Number.NaN)).toBe('')
    expect(formatCostUsd(Number.POSITIVE_INFINITY)).toBe('')
  })

  it('tra chuoi rong khi chi phi am', () => {
    expect(formatCostUsd(-1)).toBe('')
  })

  it('giu 4 chu so nghinh khi chi phi rat nho', () => {
    expect(formatCostUsd(0.0004)).toBe('0.0004')
    expect(formatCostUsd(0.00001)).toBe('0.0000')
  })

  it('giu 4 chu so nghinh khi chi phi lon hon', () => {
    expect(formatCostUsd(0.0123)).toBe('0.0123')
    expect(formatCostUsd(1.5)).toBe('1.5000')
  })
})
