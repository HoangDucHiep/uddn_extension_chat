import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageContent } from '../src/sidepanel/components/chat/MessageContent.js'

/**
 * Unit test cho chip trich dan trong Markdown (FR-CONTEXT-10 — T-M1-08).
 *
 * Kiem chung: marker `[N]` trong markdown → chip inline; span `hljs-*` cua
 * T-M1-07 **khong** bi bien thanh chip.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.9
 */

const citations = [
  {
    index: 1,
    url: 'https://example.com/bai-viet',
    title: 'Bai viet ve Sidekick',
    snippet: 'Doan trich dan ngan.',
  },
]

describe('MessageContent — citation chip', () => {
  it('marker [1] trong paragraph → render chip', () => {
    render(<MessageContent content={'Gia do la 30% [1] va day.'} citations={citations} />)

    expect(screen.getByTestId('citation-chip-1')).toBeDefined()
    expect(screen.getByTestId('citation-chip-1').textContent).toBe('[1]')
  })

  it('chip co metadata → render nut (co popover)', () => {
    render(<MessageContent content={'Gia do la 30% [1].'} citations={citations} />)

    expect(screen.getByTestId('citation-chip-1').tagName).toBe('BUTTON')
  })

  it('chip KHONG co metadata → render span (khong nut)', () => {
    render(<MessageContent content={'Gia do la 30% [1].'} />)

    expect(screen.getByTestId('citation-chip-1').tagName).toBe('SPAN')
  })

  it('marker [2] khong co trong danh sach → chi render chip so', () => {
    render(<MessageContent content={'Nguon [2] khong ton tai.'} citations={citations} />)

    expect(screen.getByTestId('citation-chip-2').tagName).toBe('SPAN')
  })

  it('nhieu marker trong cung 1 paragraph → nhieu chip', () => {
    render(
      <MessageContent
        content={'a [1] b [2]'}
        citations={[
          ...citations,
          { index: 2, url: 'https://example.org/b', title: 'B', snippet: 's' },
        ]}
      />,
    )

    expect(screen.getByTestId('citation-chip-1')).toBeDefined()
    expect(screen.getByTestId('citation-chip-2')).toBeDefined()
  })

  it('marker trong inline code → KHONG thanh chip', () => {
    const { container } = render(
      <MessageContent content={'dung `arr[1]` o day'} citations={citations} />,
    )

    expect(container.querySelector('code')?.textContent).toBe('arr[1]')
    expect(container.querySelector('.citation-chip')).toBeNull()
  })

  it('marker trong code block → KHONG thanh chip', () => {
    const { container } = render(
      <MessageContent content={'```ts\nconst a = arr[1]\n```'} citations={citations} />,
    )

    expect(container.querySelector('code')?.textContent).toContain('arr[1]')
    expect(container.querySelector('.citation-chip')).toBeNull()
  })

  it('span.hljs-* cua T-M1-07 van render binh thuong (khong thanh chip)', () => {
    const { container } = render(
      <MessageContent content={'```typescript\nconst a = 1\n```'} isStreaming={false} />,
    )

    const keyword = container.querySelector('.hljs-keyword')
    expect(keyword).not.toBeNull()
    expect(keyword?.tagName).toBe('SPAN')
    expect(keyword?.className).toContain('hljs-keyword')
    expect(keyword?.getAttribute('data-citation-index')).toBeNull()
  })

  it('text khong co marker → khong render chip nao', () => {
    const { container } = render(
      <MessageContent content={'Khong trich dan gi ca.'} citations={citations} />,
    )

    expect(container.querySelector('.citation-chip')).toBeNull()
  })
})
