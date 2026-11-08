import { useCallback, useRef, useState } from 'react'
import { CircleAlert, Loader2, Send } from 'lucide-react'
import type { ProviderId } from '@sidekick/shared'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { streamChat } from '@/lib/sseClient'
import { useI18n } from '@/sidepanel/hooks/useI18n'

/**
 * Buoc 3 cua onboarding — thu mot cau hoi that (FR-UX-02).
 *
 * Dung **SSE that** (`streamChat`) — khong mock. User thay duoc cau tra loi
 * cua mo hinh truoc khi bam "Hoan tat".
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.6
 */

export interface StepTryProps {
  /** Provider da chon (neu co) → gui len server de dung dung model. */
  provider: ProviderId | undefined
  /** Hoan tat onboarding. */
  onComplete: () => void
  /** Bo qua buoc nay (van hoan tat onboarding). */
  onSkip: () => void
}

export function StepTry({ provider, onComplete, onSkip }: StepTryProps) {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | undefined>(undefined)

  /**
   * Gui cau hoi that toi BFF va hien thi token ngay khi den.
   */
  const handleSend = useCallback(async (): Promise<void> => {
    const trimmed = input.trim()
    if (trimmed.length === 0 || isStreaming) return

    setError(undefined)
    setAnswer('')
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      for await (const event of streamChat(
        {
          messages: [{ role: 'user', content: trimmed }],
          ...(provider !== undefined ? { provider } : {}),
        },
        { signal: controller.signal },
      )) {
        if (event.type === 'token') {
          setAnswer((previous) => previous + event.delta)
        } else if (event.type === 'error') {
          setError(event.message)
        }
      }
    } catch (caught) {
      const isAbort = caught instanceof Error && caught.name === 'AbortError'
      if (!isAbort) {
        setError(caught instanceof Error ? caught.message : String(caught))
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = undefined
    }
  }, [input, isStreaming, provider])

  const handleStop = (): void => {
    abortRef.current?.abort()
  }

  return (
    <section className="flex flex-col gap-[var(--space-4)]" data-testid="onboarding-step-try">
      <header className="flex flex-col gap-1">
        <h2 className="text-[length:var(--font-size-lg)] font-semibold text-[var(--text-primary)]">
          {t('onboarding.try.title')}
        </h2>
        <p className="text-[length:var(--font-size-sm)] text-[var(--text-secondary)]">
          {t('onboarding.try.description')}
        </p>
      </header>

      <Textarea
        value={input}
        rows={3}
        placeholder={t('onboarding.try.placeholder')}
        aria-label={t('onboarding.try.askLabel')}
        onChange={(event) => {
          setInput(event.target.value)
        }}
        data-testid="onboarding-try-input"
      />

      {error !== undefined && (
        <p
          className="flex items-center gap-2 text-[length:var(--font-size-sm)] text-[var(--danger)]"
          data-testid="onboarding-try-error"
        >
          <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {answer.length > 0 && (
        <div
          className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-[var(--space-3)] py-[var(--space-2)]"
          data-testid="onboarding-try-answer"
        >
          <p className="whitespace-pre-wrap text-[length:var(--font-size-sm)] text-[var(--text-primary)]">
            {answer}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        {isStreaming ? (
          <Button variant="outline" onClick={handleStop} data-testid="onboarding-try-stop">
            {t('composer.stop')}
          </Button>
        ) : (
          <Button
            onClick={() => {
              void handleSend()
            }}
            disabled={input.trim().length === 0}
            data-testid="onboarding-try-send"
          >
            {isStreaming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {t('onboarding.try.send')}
          </Button>
        )}
        <Button variant="secondary" onClick={onSkip} data-testid="onboarding-skip">
          {t('onboarding.skip')}
        </Button>
      </div>

      <Button onClick={onComplete} data-testid="onboarding-complete">
        {t('onboarding.finish')}
      </Button>
    </section>
  )
}
