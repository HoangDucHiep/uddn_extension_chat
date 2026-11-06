import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MessageContent } from '../src/sidepanel/components/chat/MessageContent.js'
import { toast } from 'sonner'

/**
 * Unit test cho renderer Markdown trong side panel (T-M1-07).
 *
 * Kiem chung: render dung, XSS (sanitize), code block + copy, bang GFM,
 * va chien luoc **defer highlight khi streaming** (NFR-PERF-02).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.8
 */

/** Mock `sonner` de assert toast ma khong can render Toaster. */
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

/** Clipboard gia lap. */
const writeTextMock = vi.fn(async (_text: string): Promise<void> => undefined)

describe('MessageContent — render Markdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('render heading h1/h2', () => {
    render(<MessageContent content={'# Tieu de 1\n\n## Tieu de 2'} />)

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tieu de 1')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Tieu de 2')
  })

  it('render danh sach ul/ol', () => {
    const { container } = render(<MessageContent content={'- muc 1\n- muc 2\n\n1. dong 1\n2. dong 2'} />)

    expect(container.querySelectorAll('ul li')).toHaveLength(2)
    expect(container.querySelectorAll('ol li')).toHaveLength(2)
  })

  it('render blockquote', () => {
    const { container } = render(<MessageContent content={'> trich dan'} />)

    expect(container.querySelector('blockquote')?.textContent).toContain('trich dan')
  })

  it('render bold va italic', () => {
    const { container } = render(<MessageContent content={'**dam** va *nghieng*'} />)

    expect(container.querySelector('strong')?.textContent).toBe('dam')
    expect(container.querySelector('em')?.textContent).toBe('nghieng')
  })

  it('render inline code', () => {
    const { container } = render(<MessageContent content={'dung `const a = 1` o day'} />)

    const inline = container.querySelector('p code')
    expect(inline?.textContent).toBe('const a = 1')
  })

  it('render strikethrough (GFM)', () => {
    const { container } = render(<MessageContent content={'~~xoa~~'} />)

    expect(container.querySelector('del')?.textContent).toBe('xoa')
  })
})

describe('MessageContent — link an toan', () => {
  it('link mo tab moi + chan opener', () => {
    render(<MessageContent content={'[trang](https://example.com)'} />)

    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('https://example.com')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('chan javascript: protocol', () => {
    const { container } = render(<MessageContent content={'[x](javascript:alert(1))'} />)

    const href = container.querySelector('a')?.getAttribute('href') ?? ''
    expect(href).not.toContain('javascript:')
  })
})

describe('MessageContent — XSS', () => {
  it('khong render script tag', () => {
    const { container } = render(
      <MessageContent content={'<script>alert(1)</script>\n\nvan ban'} />,
    )

    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('van ban')
  })

  it('khong render onerror tren img', () => {
    const { container } = render(
      <MessageContent content={'<img src="x" onerror="alert(1)">'} />,
    )

    // `skipHtml` → raw HTML bi loai hoan toan (khong con `img` nao).
    expect(container.querySelector('img[onerror]')).toBeNull()
    expect(container.innerHTML).not.toContain('onerror')
  })

  it('bo attribute style (khong style injection)', () => {
    const { container } = render(
      <MessageContent content={'<div style="position:fixed">x</div>'} />,
    )

    expect(container.querySelector('div[style]')).toBeNull()
  })

  it('sanitize loai class khong duoc phep (chi giu class theo schema)', () => {
    // `class` tren `div` khong nam trong schema → `rehype-sanitize` loai.
    // React-markdown (khong co sanitize) se giu nguyen → test bat regression.
    const { container } = render(
      <MessageContent content={'<div class="evil-class">x</div>'} />,
    )

    expect(container.querySelector('.evil-class')).toBeNull()
    expect(container.innerHTML).not.toContain('evil-class')
  })

  it('sanitize gioi han protocol href (chan `irc:` theo allowlist)', () => {
    // `react-markdown` mac dinh cho phep `irc:` → chi `rehype-sanitize` voi
    // allowlist `http/https/mailto` moi loai → test bat regression khi bo
    // `rehype-sanitize`.
    const { container } = render(<MessageContent content={'[x](irc://example.com)'} />)

    const href = container.querySelector('a')?.getAttribute('href') ?? ''
    expect(href).not.toContain('irc:')
  })
})

describe('MessageContent — code block', () => {
  it('co data-testid code-block + nhan ngon ngu', () => {
    render(<MessageContent content={'```typescript\nconst a: number = 1\n```'} />)

    expect(screen.getByTestId('code-block')).toBeDefined()
    expect(screen.getByTestId('code-block-language').textContent).toBe('typescript')
  })

  it('khong co nhan ngon ngu → hien thi "text"', () => {
    render(<MessageContent content={'```\nplain\n```'} />)

    expect(screen.getByTestId('code-block-language').textContent).toBe('text')
  })

  it('sinh token highlight khi stream xong', () => {
    const { container } = render(
      <MessageContent content={'```typescript\nconst a = 1\n```'} isStreaming={false} />,
    )

    expect(container.querySelector('.hljs-keyword')).not.toBeNull()
  })

  it('ngon ngu la → khong crash, khong co token highlight', () => {
    const { container } = render(
      <MessageContent content={'```khongTonTai\nxyz\n```'} isStreaming={false} />,
    )

    expect(screen.getByTestId('code-block')).toBeDefined()
    expect(container.querySelector('.hljs-keyword')).toBeNull()
  })

  it('alias ngon ngu (ts) → highlight duoc', () => {
    const { container } = render(
      <MessageContent content={'```ts\nconst a = 1\n```'} isStreaming={false} />,
    )

    expect(container.querySelector('.hljs-keyword')).not.toBeNull()
  })
})

describe('MessageContent — streaming defer highlight (NFR-PERF-02)', () => {
  it('dang stream → CHUA co token highlight', () => {
    const { container } = render(
      <MessageContent content={'```typescript\nconst a = 1\n```'} isStreaming />,
    )

    expect(screen.getByTestId('code-block')).toBeDefined()
    expect(container.querySelector('.hljs-keyword')).toBeNull()
  })

  it('chuyen sang done → co token highlight', async () => {
    const { container, rerender } = render(
      <MessageContent content={'```typescript\nconst a = 1\n```'} isStreaming />,
    )

    expect(container.querySelector('.hljs-keyword')).toBeNull()

    rerender(<MessageContent content={'```typescript\nconst a = 1\n```'} isStreaming={false} />)

    await waitFor(() => {
      expect(container.querySelector('.hljs-keyword')).not.toBeNull()
    })
  })
})

describe('MessageContent — copy code', () => {
  it('click copy → clipboard nhan source code tho + toast', async () => {
    render(<MessageContent content={'```typescript\nconst a = 1\n```'} />)

    fireEvent.click(screen.getByTestId('code-block-copy'))

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1)
    })
    expect(writeTextMock.mock.calls[0]?.[0]).toBe('const a = 1\n')
    expect(toast.success).toHaveBeenCalledWith('Đã sao chép')
  })

  it('doi icon sang Check sau khi copy', async () => {
    const { container } = render(<MessageContent content={'```ts\nx\n```'} />)

    expect(container.querySelector('.lucide-copy')).not.toBeNull()

    fireEvent.click(screen.getByTestId('code-block-copy'))

    await waitFor(() => {
      expect(container.querySelector('.lucide-check')).not.toBeNull()
    })
  })

  it('clipboard loi → toast error', async () => {
    writeTextMock.mockRejectedValueOnce(new Error('blocked'))

    render(<MessageContent content={'```ts\nx\n```'} />)
    fireEvent.click(screen.getByTestId('code-block-copy'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Không sao chép được')
    })
  })
})

describe('MessageContent — bang GFM (FR-CHAT-04)', () => {
  it('render table co wrapper overflow-x-auto', () => {
    const { container } = render(
      <MessageContent content={'| a | b |\n| - | - |\n| 1 | 2 |'} />,
    )

    const wrapper = screen.getByTestId('markdown-table-wrapper')
    expect(wrapper.className).toContain('overflow-x-auto')
    expect(container.querySelector('table')).not.toBeNull()
  })

  it('render dung so cot / so dong', () => {
    const { container } = render(
      <MessageContent content={'| a | b |\n| - | - |\n| 1 | 2 |\n| 3 | 4 |'} />,
    )

    expect(container.querySelectorAll('thead th')).toHaveLength(2)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(container.querySelectorAll('tbody tr:first-child td')).toHaveLength(2)
  })
})
