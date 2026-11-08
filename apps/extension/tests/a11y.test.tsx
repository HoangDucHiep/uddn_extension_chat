import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'

import { Composer } from '../src/sidepanel/components/Composer'
import { MessageBubble } from '../src/sidepanel/components/MessageBubble'
import { MessageContent } from '../src/sidepanel/components/chat/MessageContent'
import { PanelHeader } from '../src/sidepanel/components/PanelHeader'
import { ContextChips } from '../src/sidepanel/components/context/ContextChips'
import type { ChatMessage } from '../src/sidepanel/store/chatStore'

/**
 * Unit test a11y (FR-UX-07/09/10 + NFR-A11Y-01..05 — T-M1-20).
 *
 * 3 nhom kiem chung:
 *  - (1) **Icon-button** deu co `aria-label` (khong nut icon-only khong nhan).
 *  - (2) **Live region** cho streaming: `aria-live="polite"` tren phan vua
 *        stream + `role="status"` cho dong "dang tao cau tra loi".
 *  - (3) **Source-level**: khong con `focus-visible:outline-none` khong
 *        kem ring thay the; tap target icon >= 24px.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.19
 */

/** Thu muc component cua side panel (de quet source). */
const SIDEPANEL_DIR = join(process.cwd(), 'src', 'sidepanel')

/** Thu muc component dung chung. */
const UI_DIR = join(process.cwd(), 'src', 'components', 'ui')

/**
 * Doc tat ca file `.tsx` cua 1 thu muc (de quet source).
 *
 * @param dir - Thu muc can quet.
 * @returns Danh sach noi dung file.
 */
function readTsxFiles(dir: string): Array<{ path: string; content: string }> {
  const out: Array<{ path: string; content: string }> = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...readTsxFiles(full))
      continue
    }
    if (!entry.endsWith('.tsx')) continue
    out.push({ path: full, content: readFileSync(full, 'utf8') })
  }
  return out
}

/** Tao message assistant gia lap cho test. */
function assistantMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    content: 'Xin chao',
    status: 'done',
    createdAt: 0,
    ...overrides,
  } as ChatMessage
}

describe('a11y — icon-button co aria-label', () => {
  it('PanelHeader: moi nut icon co aria-label', () => {
    render(
      <PanelHeader
        onOpenConversations={() => undefined}
        onOpenOnboarding={() => undefined}
        onOpenSettings={() => undefined}
        onClear={() => undefined}
      />,
    )

    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      const label = button.getAttribute('aria-label')
      expect(
        label !== null && label.length > 0,
        `nut icon thieu aria-label: ${button.outerHTML.slice(0, 120)}`,
      ).toBe(true)
    }
  })

  it('ContextChips: nut xoa chip co aria-label', () => {
    render(
      <ContextChips
        items={[
          {
            id: 'ctx-1',
            kind: 'page',
            tier: 'currentTab',
            title: 'Trang tài liệu',
            url: 'https://example.com',
            text: 'Noi dung trang',
          },
        ]}
        enabled={true}
        onToggle={() => undefined}
        onAddCurrentTab={() => undefined}
        onRemove={() => undefined}
      />,
    )

    const removeButton = screen.getByTestId('context-chip').querySelector('button')
    expect(removeButton).not.toBeNull()
    expect(removeButton?.getAttribute('aria-label')).toBeTruthy()
  })
})

describe('a11y — live region khi streaming', () => {
  it('MessageContent: aria-live="polite" khi dang stream', () => {
    render(<MessageContent content="Dang tra loi" isStreaming />)

    const content = screen.getByTestId('message-content')
    expect(content.getAttribute('aria-live')).toBe('polite')
    expect(content.getAttribute('aria-atomic')).toBe('false')
    expect(content.getAttribute('role')).toBe('article')
  })

  it('MessageContent: KHONG co aria-live khi stream xong', () => {
    render(<MessageContent content="Xong roi" isStreaming={false} />)

    const content = screen.getByTestId('message-content')
    expect(content.getAttribute('aria-live')).toBeNull()
  })

  it('MessageBubble: dong "dang tao cau tra loi" co role="status"', () => {
    render(
      <MessageBubble
        message={assistantMessage({ content: '', status: 'streaming' })}
      />,
    )

    const status = screen.getByRole('status')
    expect(status.textContent?.trim().length).toBeGreaterThan(0)
  })
})

describe('a11y — composer', () => {
  it('oi nhap co aria-label + hint da duoc dich', () => {
    render(
      <Composer
        value=""
        onChange={() => undefined}
        onSend={() => undefined}
        onStop={() => undefined}
        isStreaming={false}
      />,
    )

    const input = screen.getByTestId('composer-input')
    expect(input.getAttribute('aria-label')).toBeTruthy()
    // Hint phai lay tu i18n (khong con chuoi literal).
    expect(screen.getByTestId('composer').textContent).toContain('Enter')
  })
})

describe('a11y — source-level (focus ring + tap target)', () => {
  const files = [...readTsxFiles(SIDEPANEL_DIR), ...readTsxFiles(UI_DIR)]

  it('khong con focus-visible:outline-none ma khong co ring thay the', () => {
    for (const file of files) {
      expect(
        file.content.includes('focus-visible:outline-none'),
        `${file.path} con dung "focus-visible:outline-none"`,
      ).toBe(false)
    }
  })

  it('khong con focus-visible:ring-[var(--focus-ring)] (da chuan hoa sang outline-*)', () => {
    for (const file of files) {
      expect(
        file.content.includes('focus-visible:ring-[var(--focus-ring)]'),
        `${file.path} con dung "focus-visible:ring-[var(--focus-ring)]"`,
      ).toBe(false)
    }
  })

  it('nut icon-only co kich thuoc toi thieu 24px', () => {
    // Nut icon-only = khong co text, chi co icon lucide.
    // Phai co class kich thuoc toi thieu 24px (h-6 w-6 / h-7 w-7 / ...).
    const buttonPattern = /<button\b[\s\S]{0,800}?<\/button>/g
    for (const file of files) {
      const matches = file.content.matchAll(buttonPattern)
      for (const match of matches) {
        const block = match[0]
        const classMatch = /className="([^"]*)"/.exec(block)
        const className = classMatch?.[1] ?? ''

        // Tach phan children (sau the mo dong `<button ...>`).
        const openEnd = block.indexOf('>')
        const children = block.slice(openEnd + 1, block.lastIndexOf('</button>'))
        // Co text neu chua chuoi chu hoac bieu thuc JSX `{...}`.
        const hasText = /[A-Za-zÀ-ỹ]{2,}/.test(children) || /\{/.test(children)
        if (hasText) continue

        // Nut icon-only phai co kich thuoc rõ rang.
        const hasSize = /h-6|h-7|h-8|h-9|h-10|h-11|h-12/.test(className)
        expect(
          hasSize,
          `${file.path} nut icon-only thieu kich thuoc >= 24px: ${block.slice(0, 160)}`,
        ).toBe(true)
      }
    }
  })
})
