import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import type * as React from 'react'

/**
 * Test riêng cho chien luoc defer khi streaming (NFR-PERF-02 — T-M1-07).
 *
 * Tach file rieng vi can mock `useDeferredValue` cua React — mock nay ap
 * dung cho **ca file** nen khong lam nhieu test khac.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.8
 */

const useDeferredValueMock = vi.fn()

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof React>()
  return {
    ...actual,
    useDeferredValue: (value: unknown) => {
      useDeferredValueMock(value)
      return value
    },
  }
})

// Import sau khi mock da khai bao (vi.mock duoc hoist).
const { MessageContent } = await import(
  '../src/sidepanel/components/chat/MessageContent.js'
)

describe('MessageContent — useDeferredValue (NFR-PERF-02)', () => {
  it('goi useDeferredValue voi noi dung hien tai', () => {
    useDeferredValueMock.mockClear()

    render(<MessageContent content={'# Tieu de'} isStreaming />)

    expect(useDeferredValueMock).toHaveBeenCalledWith('# Tieu de')
  })

  it('goi lai useDeferredValue khi noi dung thay doi', () => {
    useDeferredValueMock.mockClear()

    const { rerender } = render(<MessageContent content={'a'} isStreaming />)
    rerender(<MessageContent content={'ab'} isStreaming />)

    expect(useDeferredValueMock).toHaveBeenCalledWith('a')
    expect(useDeferredValueMock).toHaveBeenCalledWith('ab')
  })
})
