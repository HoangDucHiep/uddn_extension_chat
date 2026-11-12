import { ChevronRight, RefreshCw } from 'lucide-react'
import type { PageProfile, PromptSuggestion } from '@sidekick/shared'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
 * Phong cach T-M3-POLISH: hero (badge pill + tieu de lon) + hang goi y la
 * **row co vien** voi icon tile mau pastel ben trai + chevron ben phai.
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
   * Trang hien tai doc duoc (http/https) hay khong.
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
 * Mau pastel cua icon tile — xoay vong 4 sac.
 *
 * Chi **nen** co mau; icon giu mau trung tinh → không phá nguyen tac
 * "semantic color la mau duy nhat duoc phep".
 */
const TINT_CLASS = [
  'bg-[var(--chip-tint-mint)]',
  'bg-[var(--chip-tint-amber)]',
  'bg-[var(--chip-tint-lavender)]',
  'bg-[var(--chip-tint-sky)]',
] as const

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
      className="flex h-full flex-col items-center gap-4 px-[var(--space-2)] pt-[var(--space-4)] text-center"
      data-testid="prompt-gallery"
      data-profile={profile}
    >
      {/* --- Hero: badge pill + tieu de lon + phu de --- */}
      <div className="flex w-full flex-col items-center gap-2">
        <span
          className="inline-flex items-center rounded-[var(--radius-full)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2.5 py-0.5 text-[length:var(--font-size-xs)] font-medium text-[var(--text-secondary)]"
          data-testid="prompt-gallery-badge"
        >
          {t('header.title')}
        </span>
        <p
          className="text-[length:var(--font-size-xl)] font-semibold leading-tight text-[var(--text-primary)]"
          data-testid="prompt-gallery-greeting"
        >
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
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onRefresh}
                disabled={isSending}
                aria-label={t('prompt.gallery.refresh')}
                data-testid="prompt-gallery-refresh"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-full)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('prompt.gallery.refresh')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* --- Hang goi y: row co vien + icon tile + chevron --- */}
      <ul className="grid w-full grid-cols-1 gap-2" data-testid="prompt-gallery-list">
        {suggestions.map((suggestion, index) => (
          <li key={suggestion.id}>
            <button
              type="button"
              onClick={() => {
                onSelect(suggestion.prompt)
              }}
              disabled={isSending}
              data-testid="prompt-suggestion"
              data-suggestion-id={suggestion.id}
              className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2.5 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {/* Icon tile bo goc, nen pastel — chi 1 mau chom, khong gam. */}
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[length:var(--font-size-sm)] font-semibold text-[var(--text-secondary)] ${TINT_CLASS[index % TINT_CLASS.length]}`}
                aria-hidden="true"
              >
                {suggestion.label.trim().charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[length:var(--font-size-sm)] font-medium text-[var(--text-primary)]">
                  {suggestion.label}
                </span>
                <span className="mt-0.5 block line-clamp-2 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
                  {suggestion.prompt}
                </span>
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]"
                aria-hidden="true"
              />
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
