import { AlertCircle, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CitationList } from './chat/CitationList'
import { MessageContent } from './chat/MessageContent'
import type { ChatMessage } from '../store/chatStore'

export interface MessageBubbleProps {
  message: ChatMessage
}

/**
 * Bong tin nhan — dung chung cho user va assistant.
 *
 * User message → text thuan (khong parse Markdown: an toan + nhanh).
 * Assistant message → render Markdown (FR-CHAT-02 — T-M1-07).
 */
export function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
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
      className={isUser ? 'flex justify-end' : 'flex justify-start'}
      data-testid={isUser ? 'message-user' : 'message-assistant'}
      data-role={message.role}
    >
      <div
        className={[
          'max-w-[var(--message-max-width)] rounded-[var(--radius-lg)] px-[var(--space-3)] py-[var(--space-2)]',
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
            aria-label="Ảnh đính kèm"
          >
            {message.images.map((image) => (
              <li key={image.id}>
                <button
                  type="button"
                  onClick={() => openImage(image.dataUrl)}
                  aria-label={`Mở ảnh ${image.fileName ?? 'đính kèm'}`}
                  className="block overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)] focus-visible:outline-none focus-visible:ring-[var(--focus-ring)]"
                >
                  <img
                    src={image.dataUrl}
                    alt={image.fileName ?? 'Ảnh đính kèm'}
                    className="max-h-[160px] w-auto max-w-full object-cover"
                    data-testid="message-image"
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {message.content.length > 0 ? (
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
          <span className="text-[var(--text-tertiary)]">Dang tao cau tra loi...</span>
        ) : null}

        {message.status === 'error' && message.errorMessage ? (
          <p
            className="mt-2 flex items-start gap-1 text-[length:var(--font-size-sm)] text-[var(--danger)]"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{message.errorMessage}</span>
          </p>
        ) : null}

        {!isUser && message.content.length > 0 ? (
          <div className="mt-2 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleCopy}
              aria-label="Sao chep noi dung"
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
              <span className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
                · {message.tokensOut} tokens
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Dong tom tat nguon trich dan (FR-CONTEXT-10 — T-M1-08). */}
        {!isUser && message.citations !== undefined && message.citations.length > 0 ? (
          <CitationList citations={message.citations} />
        ) : null}
      </div>
    </div>
  )
}
