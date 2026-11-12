import { FileText, X } from 'lucide-react'
import { VISION, type ImageAttachment } from '@sidekick/shared'
import { formatBytes } from '@/lib/imageUpload'
import { useI18n } from '@/sidepanel/hooks/useI18n'

/**
 * Tray dinh kem cho san — hien thi preview anh + danh sach tai lieu
 * (FR-VISION-01 — T-M1-24 · FR-CONTEXT-14 — T-M2-23).
 *
 * Khong hardcode mau — dung design token.
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.4
 */

/** Mot tai lieu da dinh kem (context item dang text). */
export interface DocumentAttachment {
  /** Id context item. */
  id: string
  /** Ten file goc. */
  title: string
  /** Trich dan ngan (neu co). */
  excerpt: string | undefined
}

export interface AttachmentTrayProps {
  /** Anh cho san (chua gui). */
  images: readonly ImageAttachment[]
  /** Xoa mot anh theo id. */
  onRemove: (id: string) => void
  /** Loi hien thi (neu co). */
  errorMessage?: string | undefined
  /** Tai lieu da dinh kem vao context (FR-CONTEXT-14). */
  documents?: readonly DocumentAttachment[]
  /** Xoa mot tai lieu theo id. */
  onRemoveDocument?: (id: string) => void
}

/**
 * Hang thumbnail phia tren Composer.
 *
 * Khong co anh → khong render (giu panel gọn).
 */
export function AttachmentTray({
  images,
  onRemove,
  errorMessage,
  documents = [],
  onRemoveDocument,
}: AttachmentTrayProps) {
  const { t } = useI18n()

  if (images.length === 0 && errorMessage === undefined && documents.length === 0) {
    return null
  }

  return (
    <div
      className="flex flex-col gap-1 border-b border-[var(--border-default)] bg-[var(--surface-panel)] px-[var(--space-3)] py-[var(--space-2)]"
      data-testid="attachment-tray"
    >
      {errorMessage !== undefined ? (
        <p
          className="text-[length:var(--font-size-xs)] text-[var(--danger)]"
          role="alert"
          data-testid="attachment-error"
        >
          {errorMessage}
        </p>
      ) : null}

      {images.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-2" data-testid="attachment-list">
          {images.map((image) => (
            <li
              key={image.id}
              className="relative inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)]"
              data-testid="attachment-thumb"
              data-image-id={image.id}
              title={image.fileName ?? `${image.mimeType} · ${formatBytes(image.bytes)}`}
            >
              <img
                src={`data:${image.mimeType};base64,${image.data}`}
                alt={image.fileName ?? t('chat.imageAttachment')}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => onRemove(image.id)}
                aria-label={t('chat.removeImage', { name: image.fileName ?? '' }).trim()}
                className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-overlay)] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* FR-CONTEXT-14 — danh sach tai lieu da dinh kem vao context. */}
      {documents.length > 0 ? (
        <ul className="flex flex-col gap-1" data-testid="document-list">
          {documents.map((document) => (
            <li
              key={document.id}
              className="inline-flex max-w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 py-1 text-[length:var(--font-size-xs)] text-[var(--text-secondary)]"
              data-testid="document-item"
              data-document-id={document.id}
              title={document.excerpt ?? document.title}
            >
              <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{document.title}</span>
              {onRemoveDocument !== undefined ? (
                <button
                  type="button"
                  onClick={() => onRemoveDocument(document.id)}
                  aria-label={t('context.remove', { title: document.title })}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {images.length > 0 ? (
        <p className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
          {t('chat.attachmentTokenEstimate', {
            count: images.length,
            tokens: images.length * VISION.TOKEN_ESTIMATE_PER_IMAGE,
          })}
        </p>
      ) : null}
    </div>
  )
}
