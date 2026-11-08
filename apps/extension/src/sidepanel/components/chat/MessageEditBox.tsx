import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/sidepanel/hooks/useI18n'

export interface MessageEditBoxProps {
  /** Noi dung ban dau cua message (de sua). */
  initialContent: string
  /** Handler khi user xac nhan gui lai. */
  onSubmit: (content: string) => void
  /** Handler khi user huy sua. */
  onCancel: () => void
  /** Dang xu ly → an nut (chong bam trung). */
  isBusy?: boolean
}

/**
 * Hop sua tin nhan user (FR-CHAT-06 — T-M1-10).
 *
 * Enter → gui lai · Shift+Enter → xuong dong · Esc → huy.
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.3
 */
export function MessageEditBox({
  initialContent,
  onSubmit,
  onCancel,
  isBusy = false,
}: MessageEditBoxProps) {
  const { t } = useI18n()
  const [content, setContent] = useState(initialContent)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus + select toan bo noi dung khi mo hop sua.
  useEffect(() => {
    const node = textareaRef.current
    if (node === null) return
    node.focus()
    node.setSelectionRange(node.value.length, node.value.length)
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
      return
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      const trimmed = content.trim()
      if (trimmed.length === 0 || isBusy) return
      onSubmit(trimmed)
    }
  }

  return (
    <div
      className="mt-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] p-[var(--space-2)]"
      data-testid="message-edit-box"
    >
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(event) => {
          setContent(event.target.value)
        }}
        onKeyDown={handleKeyDown}
        disabled={isBusy}
        aria-label={t('chat.editInputLabel')}
        data-testid="message-edit-input"
        className="min-h-[var(--composer-min-height)] w-full"
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isBusy}
          aria-label={t('chat.cancelEdit')}
          data-testid="message-edit-cancel"
        >
          {t('common.cancel')}
        </Button>
        <Button
          size="sm"
          onClick={() => {
            const trimmed = content.trim()
            if (trimmed.length === 0 || isBusy) return
            onSubmit(trimmed)
          }}
          disabled={isBusy || content.trim().length === 0}
          data-testid="message-edit-submit"
        >
          {t('chat.resend')}
        </Button>
      </div>
    </div>
  )
}
