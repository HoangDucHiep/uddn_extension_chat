import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UsageBadge } from '../src/sidepanel/components/chat/UsageBadge.js'

/**
 * Unit test cho badge token + chi phi (T-M2-03 — FR-PROVIDER-05).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.23
 */

beforeEach(() => {
  vi.clearAllMocks()
})

describe('UsageBadge', () => {
  it('KHONG render khi khong co token nao', () => {
    const { container } = render(<UsageBadge />)

    expect(container.firstChild).toBeNull()
  })

  it('hien thi token vao / token ra', () => {
    render(<UsageBadge tokensIn={120} tokensOut={45} />)

    const badge = screen.getByTestId('usage-badge')
    expect(badge.textContent).toContain('120')
    expect(badge.textContent).toContain('45')
  })

  it('chi phi 0 (provider local) → KHONG hien thi tien', () => {
    render(<UsageBadge tokensIn={10} tokensOut={5} costUsd={0} />)

    const badge = screen.getByTestId('usage-badge')
    expect(badge.textContent).not.toContain('$')
  })

  it('chi phi > 0 → hien thi tien USD', () => {
    render(<UsageBadge tokensIn={120} tokensOut={45} costUsd={0.0123} />)

    const badge = screen.getByTestId('usage-badge')
    expect(badge.textContent).toContain('$0.0123')
    expect(badge.getAttribute('data-cost-usd')).toBe('0.0123')
  })

  it('chi phi rat nho → giu 4 chu so nghinh', () => {
    render(<UsageBadge tokensIn={5} tokensOut={2} costUsd={0.0004} />)

    const badge = screen.getByTestId('usage-badge')
    expect(badge.textContent).toContain('$0.0004')
  })
})
