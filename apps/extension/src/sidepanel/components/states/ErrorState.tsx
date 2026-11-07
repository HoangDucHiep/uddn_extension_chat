import { AlertCircle, KeyRound, RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  classifyChatError,
  defaultRetryAfterSeconds,
  type ChatErrorKind,
} from '@sidekick/shared'
import { Button } from '@/components/ui/button'

/**
 * Card loi trong thread (FR-CHAT-14 — T-M1-19).
 *
 * Truoc day loi chi la 1 dong chu do **khong** co duong khoi phuc. Gio
 * moi co 1 action **dung theo nhom loi**:
 *  - `network` / `server` / `provider` → **Thu lai**.
 *  - `auth` → **Kiem tra API key** (mo drawer Settings).
 *  - `rate-limit` → **Thu lai sau Ns** voi dem nguoc truc tiep.
 *
 * Design tokens only (khong hardcode mau) + `role="alert"` + `aria-live`.
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.4
 */

export interface ErrorStateProps {
  /** Thong diep loi cua server. */
  message: string
  /** Error code chuan → phan loai nhom loi. */
  code?: string | undefined
  /** Loi co the thu lai khong (server quyet dinh). */
  retryable?: boolean | undefined
  /** So giay phai cho truoc khi thu lai (429). */
  retryAfterSeconds?: number | undefined
  /** Handler thu lai luot chat. */
  onRetry?: (() => void) | undefined
  /** Handler mo drawer Settings (dung cho loi auth). */
  onOpenSettings?: (() => void) | undefined
  /** Handler dong card loi (an thong bao). */
  onDismiss?: (() => void) | undefined
  /** Dang gui → vo hieu hoa nut. */
  isBusy?: boolean
}

/**
 * Do dai dem nguoc (giay) cho loi rate-limit.
 *
 * @param code - Error code.
 * @param retryAfterSeconds - So giay tu server.
 */
export function resolveCountdownSeconds(
  code: string | undefined,
  retryAfterSeconds: number | undefined,
): number {
  if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) return retryAfterSeconds
  const kind = classifyChatError(code ?? '')
  return defaultRetryAfterSeconds(kind) ?? 0
}

/**
 * Card loi.
 */
export function ErrorState({
  message,
  code,
  retryable = true,
  retryAfterSeconds,
  onRetry,
  onOpenSettings,
  onDismiss,
  isBusy = false,
}: ErrorStateProps) {
  const kind: ChatErrorKind = classifyChatError(code ?? '')
  const countdown = resolveCountdownSeconds(code, retryAfterSeconds)
  const isRateLimit = kind === 'rate-limit'
  const isAuth = kind === 'auth'

  // Dem nguoc 429 — khi het thi mo lai nut "Thu lai".
  const [remaining, setRemaining] = useState(countdown)
  useEffect(() => {
    setRemaining(countdown)
  }, [countdown])

  useEffect(() => {
    if (!isRateLimit) return
    // Interval (khong phai chuoi timeout) → moi giay giam 1 lan.
    const timer = setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1))
    }, 1000)
    return () => {
      clearInterval(timer)
    }
  }, [isRateLimit])

  const canRetry = retryable && !isAuth && remaining === 0

  return (
    <div
      className="mt-2 flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--surface-raised)] p-[var(--space-2)]"
      role="alert"
      aria-live="polite"
      data-testid="error-state"
      data-error-kind={kind}
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" aria-hidden="true" />
        <p
          className="flex-1 text-[length:var(--font-size-sm)] text-[var(--text-primary)]"
          data-testid="error-state-message"
        >
          {message}
        </p>
        {onDismiss !== undefined ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDismiss}
            aria-label="Dong thong bao loi"
            data-testid="error-state-dismiss"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isAuth && onOpenSettings !== undefined ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenSettings}
            disabled={isBusy}
            data-testid="error-state-check-key"
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            Kiem tra API key
          </Button>
        ) : null}

        {onRetry !== undefined && !isAuth ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onRetry}
            disabled={!canRetry || isBusy}
            data-testid="error-state-retry"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {isRateLimit && remaining > 0
              ? `Thu lai sau ${remaining}s`
              : 'Thu lai'}
          </Button>
        ) : null}

        {isAuth ? (
          <span
            className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
            data-testid="error-state-hint"
          >
            Kiem tra API key trong Settings → may chu.
          </span>
        ) : null}
      </div>
    </div>
  )
}
