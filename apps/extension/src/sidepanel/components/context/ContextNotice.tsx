import { AlertTriangle, FileWarning, X } from 'lucide-react'
import { useState } from 'react'

/**
 * Thong bao loi trich xuat context — hien thi tren Composer.
 *
 * Tinh huong:
 *  - PDF scan (khong co text layer) → goi y tai len anh (T-M1-24).
 *  - Video khong co phu de → goi y dung video co caption hoac paste transcript.
 *  - Khong tai duoc file / loi mang → bao ro.
 *
 * Khong hardcode mau — dung design token (`--warning-subtle`, `--text-secondary`).
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §5 (Context notice)
 */

export interface ContextNoticeProps {
  /** Error code tu BFF (vd `CONTEXT_PDF_NOT_READABLE`). */
  errorCode: string
  /** Thong diep goc tu BFF (co the rong). */
  message?: string | undefined
}

/** Doi error code thanh thong diep tieng Viet + icon phu hop. */
function describeError(errorCode: string): { message: string; icon: 'pdf' | 'warning' } {
  switch (errorCode) {
    case 'CONTEXT_PDF_NOT_READABLE':
      return {
        message: 'PDF nay la ban scan (khong co text layer) — hay tai len anh de Sidekick AI doc.',
        icon: 'pdf',
      }
    case 'CONTEXT_PDF_UNREACHABLE':
      return {
        message: 'Khong tai duoc file PDF (link noi bo, may chu chan hoac het quyen).',
        icon: 'pdf',
      }
    case 'CONTEXT_TRANSCRIPT_UNAVAILABLE':
      return {
        message: 'Video nay khong co phu de (caption) — Sidekick AI chua co transcript.',
        icon: 'warning',
      }
    case 'CONTEXT_SELECTION_EMPTY':
      return {
        message: 'Chua co doan van ban nao duoc boi den — hay boi den mot doan tren trang truoc.',
        icon: 'warning',
      }
    default:
      return {
        message: 'Khong trich duoc noi dung trang nay — ban van chat binh thuong.',
        icon: 'warning',
      }
  }
}

/**
 * Banner thong bao loi trich xuat context.
 *
 * Co nut dismiss de nguoi dung tat thu cong (khong tu dong mat).
 */
export function ContextNotice({ errorCode, message }: ContextNoticeProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const described = describeError(errorCode)
  const Icon = described.icon === 'pdf' ? FileWarning : AlertTriangle

  return (
    <div
      className="flex items-start gap-2 border-b border-[var(--border-default)] bg-[var(--warning-subtle)] px-[var(--space-3)] py-[var(--space-2)]"
      role="status"
      aria-live="polite"
      data-testid="context-notice"
      data-error-code={errorCode}
    >
      <Icon
        className="mt-[2px] h-4 w-4 shrink-0 text-[var(--warning)]"
        aria-hidden="true"
      />
      <p className="flex-1 text-[length:var(--font-size-sm)] text-[var(--text-secondary)]">
        {described.message}
        {message !== undefined && message.length > 0 ? ` (${message})` : ''}
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dong thong bao"
        className="shrink-0 rounded-[var(--radius-sm)] p-[2px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-[var(--focus-ring)]"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}
