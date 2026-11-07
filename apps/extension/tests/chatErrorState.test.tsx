import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ERROR_CODES } from '@sidekick/shared'
import { ErrorState, resolveCountdownSeconds } from '../src/sidepanel/components/states/ErrorState'

/**
 * Unit test cho `ErrorState` (FR-CHAT-14 — T-M1-19).
 *
 * - Moi nhom loi → dung hau dong khoi phuc.
 * - Dem nguoc 429 → mo lai nut "Thu lai" khi het.
 * - Dong card loi.
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.4
 */

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('resolveCountdownSeconds', () => {
  it('dung so giay tu server khi co', () => {
    expect(resolveCountdownSeconds(ERROR_CODES.PROVIDER_RATE_LIMITED, 42)).toBe(42)
  })

  it('fallback 60 giay cho rate-limit', () => {
    expect(resolveCountdownSeconds(ERROR_CODES.PROVIDER_RATE_LIMITED, undefined)).toBe(60)
  })

  it('nhom khac → 0 (khong dem nguoc)', () => {
    expect(resolveCountdownSeconds(ERROR_CODES.SERVICE_UNAVAILABLE, undefined)).toBe(0)
  })
})

describe('ErrorState', () => {
  it('hien message loi', () => {
    render(<ErrorState message="Khong ket noi duoc may chu" code={ERROR_CODES.SERVICE_UNAVAILABLE} />)

    expect(screen.getByTestId('error-state-message').textContent).toContain(
      'Khong ket noi duoc may chu',
    )
  })

  it('loi mang → hien nut "Thu lai"', () => {
    render(
      <ErrorState
        message="Loi mang"
        code={ERROR_CODES.SERVICE_UNAVAILABLE}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByTestId('error-state-retry')).toBeTruthy()
    expect(screen.queryByTestId('error-state-check-key')).toBeNull()
  })

  it('loi 401 → hien nut "Kiem tra API key", KHONG hien "Thu lai"', () => {
    render(
      <ErrorState
        message="API key sai"
        code={ERROR_CODES.INVALID_API_KEY}
        retryable={false}
        onRetry={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    )

    expect(screen.getByTestId('error-state-check-key')).toBeTruthy()
    expect(screen.queryByTestId('error-state-retry')).toBeNull()
  })

  it('bam "Kiem tra API key" → goi onOpenSettings', () => {
    const onOpenSettings = vi.fn()
    render(
      <ErrorState
        message="API key sai"
        code={ERROR_CODES.INVALID_API_KEY}
        retryable={false}
        onOpenSettings={onOpenSettings}
      />,
    )

    fireEvent.click(screen.getByTestId('error-state-check-key'))

    expect(onOpenSettings).toHaveBeenCalled()
  })

  it('429 → dem nguoc, nut "Thu lai" bi disable den khi het', () => {
    render(
      <ErrorState
        message="Qua tan so"
        code={ERROR_CODES.PROVIDER_RATE_LIMITED}
        retryAfterSeconds={3}
        onRetry={vi.fn()}
      />,
    )

    const button = screen.getByTestId('error-state-retry') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.textContent).toContain('3s')
  })

  it('429 → het dem nguoc thi nut "Thu lai" duoc bat', () => {
    render(
      <ErrorState
        message="Qua tan so"
        code={ERROR_CODES.PROVIDER_RATE_LIMITED}
        retryAfterSeconds={2}
        onRetry={vi.fn()}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    const button = screen.getByTestId('error-state-retry') as HTMLButtonElement
    expect(button.disabled).toBe(false)
  })

  it('bam "Thu lai" → goi onRetry', () => {
    const onRetry = vi.fn()
    render(
      <ErrorState
        message="Loi mang"
        code={ERROR_CODES.SERVICE_UNAVAILABLE}
        onRetry={onRetry}
      />,
    )

    fireEvent.click(screen.getByTestId('error-state-retry'))

    expect(onRetry).toHaveBeenCalled()
  })

  it('bam nut dong → goi onDismiss', () => {
    const onDismiss = vi.fn()
    render(
      <ErrorState
        message="Loi mang"
        code={ERROR_CODES.SERVICE_UNAVAILABLE}
        onDismiss={onDismiss}
      />,
    )

    fireEvent.click(screen.getByTestId('error-state-dismiss'))

    expect(onDismiss).toHaveBeenCalled()
  })

  it('co role=alert de trinh doc dong', () => {
    render(<ErrorState message="Loi" code={ERROR_CODES.SERVICE_UNAVAILABLE} />)

    expect(screen.getByTestId('error-state').getAttribute('role')).toBe('alert')
  })

  it('dat data-error-kind theo nhom loi', () => {
    render(<ErrorState message="Loi" code={ERROR_CODES.INVALID_API_KEY} />)

    expect(screen.getByTestId('error-state').getAttribute('data-error-kind')).toBe('auth')
  })
})
