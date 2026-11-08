import { RefreshCw } from 'lucide-react'
import type { PageProfile, PromptSuggestion } from '@sidekick/shared'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import type { TranslationKey } from '@/i18n'
import { SummarizeButton } from './SummarizeButton'

/**
 * Gallery goi y theo trang (FR-UX-03 / FR-UX-04 — T-M1-11).
 *
 * Hien thi trong empty state cua panel:
 *  - Bo goi y theo loai trang (>= 3 goi y) → bam = chay luoi.
 *  - Nut "lam moi" → xoay vong bo goi y trong cung profile.
 *  - Nut "Tom tat trang nay" → tom tat 1-click.
 *
 * Minh bach (DP-3): dong ghi chu nho cho biet se tu dinh kem trang hien tai
 * khi user chon goi y.
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.3
 */
export interface PromptGalleryProps {
  /** Loai trang hien tai (dung de hien thi nhan). */
  profile: PageProfile
  /** Tieu de trang hien tai. */
  pageTitle: string
  /** Bo goi y hien thi. */
  suggestions: readonly PromptSuggestion[]
  /** Chon 1 goi y → gui prompt. */
  onSelect: (prompt: string) => void
  /** Bam nut tom tat → tom tat trang 1-click. */
  onSummarize: () => void
  /** Bam nut lam moi → xoay vong bo goi y. */
  onRefresh: () => void
  /** Dang gui → vo hieu hoa nut. */
  isSending?: boolean
  /**
 * * Trang hien tai doc duoc (http/https) hay khong.
   *
   * Khong doc duoc → dung goi y chung (FR-UX-04) + khong nut tom tat.
   */
  canAttachPage: boolean
}

/** Key cua nhan ngan theo loai trang — hien thi tren tieu de gallery. */
const PROFILE_LABEL_KEY = {
  docs: 'prompt.gallery.docs',
  article: 'prompt.gallery.article',
  forum: 'prompt.gallery.forum',
  video: 'prompt.gallery.video',
  pdf: 'prompt.gallery.pdf',
  shopping: 'prompt.gallery.shopping',
  general: 'prompt.gallery.general',
} as const satisfies Record<PageProfile, TranslationKey>

/**
 * Gallery goi y.
 */
export function PromptGallery({
  profile,
  pageTitle,
  suggestions,
  onSelect,
  onSummarize,
  onRefresh,
  isSending = false,
  canAttachPage,
}: PromptGalleryProps) {
  const { t } = useI18n()

  return (
    <div
      className="flex h-full flex-col items-center gap-4 px-[var(--space-2)] text-center"
      data-testid="prompt-gallery"
      data-profile={profile}
    >
      <div className="flex w-full flex-col items-center gap-1">
        <p className="text-[length:var(--font-size-lg)] font-medium text-[var(--text-primary)]">
          {t('prompt.gallery.greeting')}
        </p>
        <div className="flex items-center gap-1.5">
          <p
            className="text-[length:var(--font-size-sm)] text-[var(--text-secondary)]"
            data-testid="prompt-gallery-title"
          >
            {t(PROFILE_LABEL_KEY[profile])}
            {pageTitle.length > 0 ? `: ${pageTitle}` : ''}
          </p>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isSending}
            aria-label={t('prompt.gallery.refresh')}
            data-testid="prompt-gallery-refresh"
            className="rounded-[var(--radius-sm)] p-[2px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <ul className="grid w-full grid-cols-1 gap-2" data-testid="prompt-gallery-list">
        {suggestions.map((suggestion) => (
          <li key={suggestion.id}>
            <button
              type="button"
              onClick={() => {
                onSelect(suggestion.prompt)
              }}
              disabled={isSending}
              data-testid="prompt-suggestion"
              data-suggestion-id={suggestion.id}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2 text-left text-[length:var(--font-size-sm)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="block font-medium text-[var(--text-primary)]">
                {suggestion.label}
              </span>
              <span className="mt-0.5 block line-clamp-2 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
                {suggestion.prompt}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {canAttachPage ? (
        <div className="flex w-full flex-col items-center gap-2">
          <div className="w-full">
            <SummarizeButton onSummarize={onSummarize} disabled={isSending} />
          </div>
          <p
            className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
            data-testid="prompt-gallery-notice"
          >
            {t('prompt.gallery.autoAttachNotice')}
          </p>
        </div>
      ) : null}
    </div>
  )
}
