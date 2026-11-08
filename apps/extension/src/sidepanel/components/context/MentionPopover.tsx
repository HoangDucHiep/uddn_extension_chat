import { Check, Globe, Loader2 } from 'lucide-react'
import type { OpenTab } from '@/lib/tabList'
import { useI18n } from '@/sidepanel/hooks/useI18n'

/**
 * Popover `@` — chon tab de dinh kem vao context (T-M1-05, FR-CONTEXT-03).
 *
 * Hien thi danh sach tab dang mo: favicon + tieu de + domain.
 * - Tab **da dinh kem** → danh dau check.
 * - Tab **dang active** → gach chan phat sang.
 *
 * Khong hardcode mau — dung design token.
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.4
 */

export interface MentionPopoverProps {
  /** Danh sach tab (da loc trang dac biet). */
  tabs: readonly OpenTab[]
  /** Id cua tab dang active trong cua so hien tai. */
  activeTabId: number | undefined
  /** Id cac tab da dinh kem vao context. */
  attachedTabIds: readonly number[]
  /** Dang tai danh sach tab. */
  isLoading?: boolean
  /** Chon 1 tab → dinh kem vao context. */
  onSelect: (tab: OpenTab) => void
}

/**
 * Danh sach tab trong popover.
 *
 * Khong render gi khi danh sach rong va khong loading → trong, khong de
 * man hinh trang.
 */
export function MentionPopover({
  tabs,
  activeTabId,
  attachedTabIds,
  isLoading = false,
  onSelect,
}: MentionPopoverProps) {
  const { t } = useI18n()

  if (isLoading && tabs.length === 0) {
    return (
      <div
        className="absolute bottom-full left-0 right-0 z-10 mb-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-overlay)] p-2 shadow-[var(--shadow-2)]"
        data-testid="mention-popover"
        role="listbox"
        aria-label={t('composer.mentionLabel')}
      >
        <p className="flex items-center gap-2 px-2 py-1 text-[length:var(--font-size-sm)] text-[var(--text-tertiary)]">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          {t('context.mentionLoading')}
        </p>
      </div>
    )
  }

  if (tabs.length === 0) {
    return (
      <div
        className="absolute bottom-full left-0 right-0 z-10 mb-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-overlay)] p-2 shadow-[var(--shadow-2)]"
        data-testid="mention-popover"
        role="listbox"
        aria-label={t('composer.mentionLabel')}
      >
        <p className="px-2 py-1 text-[length:var(--font-size-sm)] text-[var(--text-tertiary)]">
          {t('context.mentionEmpty')}
        </p>
      </div>
    )
  }

  return (
    <div
      className="absolute bottom-full left-0 right-0 z-10 mb-1 max-h-[240px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-overlay)] p-1 shadow-[var(--shadow-2)]"
      data-testid="mention-popover"
      role="listbox"
      aria-label={t('composer.mentionLabel')}
    >
      {tabs.map((tab) => {
        const attached = attachedTabIds.includes(tab.id)
        const isActive = tab.id === activeTabId

        return (
          <button
            key={tab.id}
            type="button"
            role="option"
            aria-selected={attached}
            onClick={() => onSelect(tab)}
            data-testid="mention-tab"
            data-tab-id={tab.id}
            className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left transition-colors hover:bg-[var(--surface-sunken)] focus-visible:outline-none focus-visible:ring-[var(--focus-ring)]"
          >
            {tab.favIconUrl !== undefined && tab.favIconUrl.length > 0 ? (
              <img
                src={tab.favIconUrl}
                alt=""
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 rounded-[2px]"
              />
            ) : (
              <Globe
                className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]"
                aria-hidden="true"
              />
            )}

            <span className="min-w-0 flex-1">
              <span className="block truncate text-[length:var(--font-size-sm)] text-[var(--text-primary)]">
                {tab.title}
              </span>
              <span className="block truncate text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
                {tab.domain}
              </span>
            </span>

            {attached ? (
              <Check
                className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]"
                aria-label={t('context.mentionAttached')}
              />
            ) : isActive ? (
              <span
                className="h-3.5 w-0.5 shrink-0 rounded-[var(--radius-full)] bg-[var(--color-accent)]"
                aria-label={t('context.mentionOpen')}
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
