import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { MessageContent } from '../src/sidepanel/components/chat/MessageContent'

/**
 * Unit test render **cong thuc toan hoc** (KaTeX — T-M3-POLISH §7.31).
 *
 * Pipeline: `remark-math` → `rehype-katex` → `rehype-sanitize` (voi
 * `markdownSchema` mo allowlist cho MathML + `span.katex`).
 *
 * Kiem chung:
 *  - `$x^2$` → sinh node `.katex` (cong thuc inline).
 *  - `$$...$$` → sinh `.katex-display`.
 *  - Code block chua `$` **khong** bi mang cong thuc (chi text tho).
 *  - Text thuong chua `$` (gia tien) khong bi bien doi.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.8 + §7.31
 */

describe('MessageContent — cong thuc toan hoc (KaTeX)', () => {
  it('inline math `$x^2$` → render node .katex', () => {
    const { container } = render(<MessageContent content={'Gia tri $x^2$ o day.'} />)

    expect(container.querySelector('.katex')).not.toBeNull()
  })

  it('block math `$$...$$` → render .katex-display', () => {
    const { container } = render(
      <MessageContent content={'\n\n$$\n\\int_0^1 x\\,dx\n$$\n\n'} />,
    )

    expect(container.querySelector('.katex-display')).not.toBeNull()
  })

  it('MathML khong bi sanitize loai (con the <math>)', () => {
    const { container } = render(<MessageContent content={'$a+b$'} />)

    expect(container.querySelector('math')).not.toBeNull()
  })

  it('code block chua `$` khong bi bien thanh cong thuc', () => {
    const { container } = render(
      <MessageContent content={'```bash\necho "$HOME"\n```'} isStreaming={false} />,
    )

    expect(container.querySelector('.katex')).toBeNull()
    expect(container.textContent).toContain('$HOME')
  })

  it('inline code chua `$` khong bi bien thanh cong thuc', () => {
    const { container } = render(<MessageContent content={'Gia `price $USD` o day'} />)

    expect(container.querySelector('.katex')).toBeNull()
  })

  it('text thuong co `$` (gia tien) khong bi bien doi', () => {
    const { container } = render(<MessageContent content={'Gia la 100$ nen mua.'} />)

    expect(container.querySelector('.katex')).toBeNull()
    expect(container.textContent).toContain('100$')
  })

  it('cong thuc render duoc ca khi dang streaming (khong defer nhu highlight)', () => {
    const { container } = render(<MessageContent content={'$x^2$'} isStreaming />)

    expect(container.querySelector('.katex')).not.toBeNull()
  })
})
