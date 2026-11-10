import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CitationList } from './chat/CitationList'
import { MessageActions } from './chat/MessageActions'
import { MessageContent } from './chat/MessageContent'
import { MessageEditBox } from './chat/MessageEditBox'
import { UsageBadge } from './chat/UsageBadge'
import { ErrorState } from './states/ErrorState'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import type { TurnMessage } from '@/lib/chatTurns'
import type { ChatMessage } from '../store/chatStore'

export interface MessageBubbleProps {
  message: ChatMessage
  /** Cac bien the assistant cua turn (T-M1-10 — FR-CHAT-05). */
  variants?: readonly TurnMessage[]
  /** Bien the dang active cua turn (T-M1-10 — FR-CHAT-05). */
  activeVariant?: TurnMessage | undefined
  /** Handler sinh lai cau tra loi (FR-CHAT-05). */
  onRegenerate?: (messageId: string) => void
  /** Handler sua tin nhan user (FR-CHAT-06). */
  onEdit?: (messageId: string) => void
  /** Handler xac nhan sua & gui lai (FR-CHAT-06). */
  onEditSubmit?: (messageId: string, content: string) => void
  /** Handler tiep tuc cau tra loi da bi stop (FR-CHAT-07). */
  onContinue?: (messageId: string) => void
  /** Handler thu lai luot chat bi loi (FR-CHAT-14 — T-M1-19). */
  onRetry?: (messageId: string) => void
  /** Handler mo drawer Settings (dung cho loi 401 — FR-CHAT-14). */
  onOpenSettings?: (() => void) | undefined
  /** Handler chuyen bien the (FR-CHAT-05). */
  onSelectVariant?: (turnId: string, variantIndex: number) => void
  /**
   * Handler luu prompt cua user thanh skill (FR-SKILL-02 — T-M2-04).
   *
   * @param content - Noi dung tin nhan user.
   */
  onSaveAsSkill?: (content: string) => void
  /** Dang stream → an thao tac phu thuoc trang thai. */
  isStreaming?: boolean
}

/**
 * Bong tin nhan — dung chung cho user va assistant.
 *
 * User message → text thuan (khong parse Markdown: an toan + nhanh).
 * Assistant message → render Markdown (FR-CHAT-02 — T-M1-07).
 */
export function MessageBubble({
  message,
  variants = [],
  activeVariant,
  onRegenerate,
  onEdit,
  onEditSubmit,
  onContinue,
  onRetry,
  onOpenSettings,
  onSelectVariant,
  onSaveAsSkill,
  isStreaming = false,
}: MessageBubbleProps) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const isUser = message.role === 'user'

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard khong truy cap duoc — bo qua.
    }
  }

  // Mo anh to trong tab moi (FR-VISION-01 — T-M1-24).
  const openImage = (dataUrl: string): void => {
    try {
      void chrome.tabs.create({ url: dataUrl })
    } catch {
      // Khong mo duoc tab → bo qua.
    }
  }

  return (
    <div
      className={isUser ? 'flex min-w-0 justify-end' : 'flex min-w-0 justify-start'}
      data-testid={isUser ? 'message-user' : 'message-assistant'}
      data-role={message.role}
    >
      <div
        className={[
          'min-w-0 max-w-[var(--message-max-width)] rounded-[var(--radius-lg)] px-[var(--space-3)] py-[var(--space-2)]',
          'text-[length:var(--font-size-md)] leading-[var(--line-height-base)]',
          isUser
            ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
            : 'bg-[var(--surface-sunken)] text-[var(--text-primary)]',
        ].join(' ')}
      >
        {message.images !== undefined && message.images.length > 0 ? (
          <ul
            className="mb-2 flex flex-wrap gap-2"
            data-testid="message-images"
            aria-label={t('chat.imageAttachment')}
          >
            {message.images.map((image) => (
              <li key={image.id}>
                <button
                  type="button"
                  onClick={() => openImage(image.dataUrl)}
                  aria-label={t('chat.openImage', {
                    name: image.fileName ?? t('chat.imageAttachment'),
                  })}
                  className="block overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
                >
                  <img
                    src={image.dataUrl}
                    alt={image.fileName ?? t('chat.imageAttachment')}
                    className="max-h-[160px] w-auto max-w-full object-cover"
                    data-testid="message-image"
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {isUser && isEditing && onEditSubmit !== undefined ? (
          <MessageEditBox
            initialContent={message.content}
            isBusy={isStreaming}
            onSubmit={(content) => {
              setIsEditing(false)
              onEditSubmit(message.id, content)
            }}
            onCancel={() => {
              setIsEditing(false)
            }}
          />
        ) : message.content.length > 0 ? (
          isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <MessageContent
              content={message.content}
              isStreaming={message.status === 'streaming'}
              citations={message.citations ?? []}
            />
          )
        ) : message.status === 'streaming' ? (
          <span className="text-[var(--text-tertiary)]" role="status">
            {t('chat.streaming')}
          </span>
        ) : null}

        {/* Card loi voi hau dong khoi phuc (FR-CHAT-14 — T-M1-19). */}
        {message.status === 'error' && message.errorMessage ? (
          <ErrorState
            message={message.errorMessage}
            code={message.errorCode}
            retryable={message.errorRetryable ?? true}
            retryAfterSeconds={message.errorRetryAfterSeconds}
            isBusy={isStreaming}
            {...(onRetry !== undefined
              ? {
                  onRetry: () => {
                    onRetry(message.id)
                  },
                }
              : {})}
            {...(onOpenSettings !== undefined ? { onOpenSettings } : {})}
          />
        ) : null}

        {!isUser && message.content.length > 0 ? (
          <div className="mt-2 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleCopy}
              aria-label={t('chat.copyContent')}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </Button>
            {message.model ? (
              <span className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
                {message.provider} · {message.model}
              </span>
            ) : null}
            {message.tokensOut !== undefined ? (
              <UsageBadge
                tokensIn={message.tokensIn}
                tokensOut={message.tokensOut}
                costUsd={message.costUsd}
              />
            ) : null}
            {/* Request-id (T-M1-14) — 6 ky tu dau de doi chieu voi log BFF. */}
            {message.requestId !== undefined ? (
              <span
                className="font-mono text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
                title={t('chat.requestId', { id: message.requestId })}
              >
                · {message.requestId.slice(0, 6)}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Thao tac tren message (T-M1-10): regenerate / edit / continue / variant. */}
        {!isEditing ? (
          <MessageActions
            message={message}
            variants={variants}
            activeVariant={activeVariant}
            isStreaming={isStreaming}
            {...(onRegenerate !== undefined ? { onRegenerate } : {})}
            {...(onEdit !== undefined
              ? {
                  onEdit: (messageId: string) => {
                    setIsEditing(true)
                    onEdit(messageId)
                  },
                }
              : {})}
            {...(onContinue !== undefined ? { onContinue } : {})}
            {...(onSelectVariant !== undefined ? { onSelectVariant } : {})}
            {...(onSaveAsSkill !== undefined ? { onSaveAsSkill } : {})}
          />
        ) : null}

        {/* Dong tom tat nguon trich dan (FR-CONTEXT-10 — T-M1-08). */}
        {!isUser && message.citations !== undefined && message.citations.length > 0 ? (
          <CitationList citations={message.citations} />
        ) : null}
      </div>
    </div>
  )
}
