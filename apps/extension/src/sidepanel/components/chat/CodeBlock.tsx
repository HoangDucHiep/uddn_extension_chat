import { Check, Copy } from 'lucide-react'
import { createContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from '@/sidepanel/hooks/useI18n'

/**
 * Code block cua Markdown (FR-CHAT-03 — T-M1-07).
 *
 * - Header: nhan ngon ngu + nut copy 1 click.
 * - Copy: `navigator.clipboard.writeText` voi **source code tho** (khong phai
 *   HTML) → toast `sonner` + doi icon sang `Check` trong 1500 ms.
 * - Nen/vi vien/mau token deu lay tu design token (khong hardcode mau).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.8, docs/DESIGN_SYSTEM_BRIEF.md §3.4
 */

/**
 * Context danh dau "dang o trong code block".
 *
 * `react-markdown` render `code` **trong** `pre` → `code` component khong
 * biet cha me la gi. `MessageContent` dat `Provider` **bên trong** `<pre>`
 * (xem `PreOverride`) → `code` component doc duoc context nay de phan biet
 * code block voi inline code.
 */
export const CodeBlockContext = createContext(false)

export interface CodeBlockProps {
  /** Source code tho (khong co markup highlight) — dung cho copy. */
  code: string
  /** Ten ngon ngu (vd `typescript`). Khong co → `text`. */
  language?: string | undefined
  /** Noi dung da highlight (React element cua `code`). */
  children: ReactNode
}

/** Thoi gian hien icon `Check` sau khi copy (ms). */
const COPIED_FEEDBACK_MS = 1_500

export function CodeBlock({ code, language, children }: CodeBlockProps) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Don timer khi unmount → tranh setState tren component da bo.
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleCopy = async (): Promise<void> => {
    try {
      if (navigator.clipboard === undefined) {
        throw new Error('Clipboard khong kha dung')
      }
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success(t('toast.copied'))
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        setCopied(false)
      }, COPIED_FEEDBACK_MS)
    } catch {
      toast.error(t('toast.copyFailed'))
    }
  }

  return (
    <div
      className="my-[var(--space-2)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--code-border)] bg-[var(--code-bg)]"
      data-testid="code-block"
      data-language={language ?? 'text'}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--code-border)] px-[var(--space-2)] py-1">
        <span
          className="truncate font-mono text-[length:var(--font-size-xs)] uppercase tracking-wide text-[var(--text-tertiary)]"
          data-testid="code-block-language"
        >
          {language ?? 'text'}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => {
                void handleCopy()
              }}
              aria-label={t('chat.copyCode')}
              className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-full)] text-[var(--text-tertiary)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
              data-testid="code-block-copy"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('chat.copyCode')}</TooltipContent>
        </Tooltip>
      </div>

      <pre
        className="max-w-full overflow-x-auto p-[var(--space-2)] font-mono text-[length:var(--font-size-sm)] leading-[var(--line-height-base)] text-[var(--code-fg)]"
        data-testid="code-block-pre"
      >
        {children}
      </pre>
    </div>
  )
}
