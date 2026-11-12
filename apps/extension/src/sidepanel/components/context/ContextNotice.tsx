import { AlertTriangle, FileWarning, X } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import { useChatStore } from '@/sidepanel/store/chatStore'
import type { TranslationKey } from '@/i18n'

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

/** Key dich cho tung error code. */
const ERROR_MESSAGE_KEY: Record<string, TranslationKey> = {
  CONTEXT_PDF_NOT_READABLE: 'context.notice.pdfNotReadable',
  CONTEXT_PDF_UNREACHABLE: 'context.notice.pdfUnreachable',
  CONTEXT_TRANSCRIPT_UNAVAILABLE: 'context.notice.transcriptUnavailable',
  CONTEXT_SELECTION_EMPTY: 'context.notice.selectionEmpty',
  DOCUMENT_NOT_READABLE: 'context.notice.documentNotReadable',
  DOCUMENT_UNSUPPORTED_TYPE: 'context.notice.documentUnsupportedType',
  DOCUMENT_TOO_LARGE: 'context.notice.documentTooLarge',
  DOCUMENT_EMPTY: 'context.notice.documentEmpty',
}

/**
 * Doi error code thanh key dich + icon phu hop.
 *
 * @param errorCode - Error code tu BFF.
 */
function describeError(errorCode: string): { key: TranslationKey; icon: 'pdf' | 'warning' } {
  switch (errorCode) {
    case 'CONTEXT_PDF_NOT_READABLE':
      return { key: 'context.notice.pdfNotReadable', icon: 'pdf' }
    case 'CONTEXT_PDF_UNREACHABLE':
      return { key: 'context.notice.pdfUnreachable', icon: 'pdf' }
    case 'CONTEXT_TRANSCRIPT_UNAVAILABLE':
      return { key: 'context.notice.transcriptUnavailable', icon: 'warning' }
    case 'CONTEXT_SELECTION_EMPTY':
      return { key: 'context.notice.selectionEmpty', icon: 'warning' }
    case 'DOCUMENT_NOT_READABLE':
      return { key: 'context.notice.documentNotReadable', icon: 'pdf' }
    case 'DOCUMENT_UNSUPPORTED_TYPE':
      return { key: 'context.notice.documentUnsupportedType', icon: 'warning' }
    case 'DOCUMENT_TOO_LARGE':
      return { key: 'context.notice.documentTooLarge', icon: 'warning' }
    case 'DOCUMENT_EMPTY':
      return { key: 'context.notice.documentEmpty', icon: 'warning' }
    default:
      return { key: ERROR_MESSAGE_KEY[errorCode] ?? 'context.notice.generic', icon: 'warning' }
  }
}

/**
 * Banner thong bao loi trich xuat context.
 *
 * Co nut dismiss de nguoi dung tat thu cong (khong tu dong mat).
 *
 * Dismiss **xoa luon** loi trong `chatStore` (khong chi an trong UI) →
 * loi da xu ly khong "keo" theo khi user tiep tuc lam viec (fix T-M2-23).
 */
export function ContextNotice({ errorCode, message }: ContextNoticeProps) {
  const { t } = useI18n()
  const [dismissed, setDismissed] = useState(false)
  const setContextError = useChatStore((state) => state.setContextError)

  if (dismissed) return null

  const described = describeError(errorCode)
  const Icon = described.icon === 'pdf' ? FileWarning : AlertTriangle

  const handleDismiss = (): void => {
    setDismissed(true)
    setContextError({})
  }

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
        {t(described.key)}
        {message !== undefined && message.length > 0 ? ` (${message})` : ''}
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t('context.notice.dismiss')}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}
