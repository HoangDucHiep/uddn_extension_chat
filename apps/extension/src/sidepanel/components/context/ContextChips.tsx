import { FileText, Globe, MousePointer, MousePointer2, Plus, X } from 'lucide-react'
import type { ContextItem } from '@sidekick/shared'
import { useI18n } from '@/sidepanel/hooks/useI18n'

/**
 * Chip context — hien thi cac item nguoi dung da dinh kem + nut them trang.
 *
 * Model moi (FR-CONTEXT-07): context **khong** tu dong — chi nhung gi user
 * dinh kem moi duoc gui len. Chip la noi bang "ban dang chia se gi" (DP-3).
 *
 * Khong hardcode mau — dung design token.
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.4
 */

export interface ContextChipsProps {
  /** Cac item da dinh kem. */
  items: readonly ContextItem[]
  /** Trang thai bat/tat context. */
  enabled: boolean
  /** Bat/tat context. */
  onToggle: (enabled: boolean) => void
  /** Dinh kem tab dang active (noi dung "Them trang nay"). */
  onAddCurrentTab: () => void
  /**
   * Dinh kem doan text user dang boi tren trang (T-M1-02).
   *
   * Duong B — dung khi user boi den tren trang roi bam nut nay trong panel.
   */
  onAttachSelection?: () => void
  /** Xoa mot item theo id. */
  onRemove: (id: string) => void
  /** Dang trich xuat → vo hieu hoa nut them. */
  isAttaching?: boolean
}

/** Icon theo loai item. */
function iconForKind(kind: ContextItem['kind']): typeof Globe {
  switch (kind) {
    case 'selection':
      return MousePointer
    case 'file':
      return FileText
    default:
      return Globe
  }
}

/**
 * Hang chip context.
 *
 * Khi khong co item nao → chi hien toggle + nut "Them trang nay".
 */
export function ContextChips({
  items,
  enabled,
  onToggle,
  onAddCurrentTab,
  onAttachSelection,
  onRemove,
  isAttaching = false,
}: ContextChipsProps) {
  const { t } = useI18n()

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-[var(--border-default)] bg-[var(--surface-panel)] px-[var(--space-3)] py-[var(--space-2)]"
      data-testid="context-chips"
    >
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? t('context.toggleOff') : t('context.toggleOn')}
        onClick={() => onToggle(!enabled)}
        data-testid="context-toggle"
        className={`inline-flex min-h-[24px] items-center gap-1 rounded-[var(--radius-full)] border px-2 py-[2px] text-[length:var(--font-size-xs)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] ${
          enabled
            ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
            : 'border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-tertiary)]'
        }`}
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-[var(--radius-full)] ${
            enabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--text-tertiary)]'
          }`}
        />
        {t('context.label')}
      </button>

      {items.map((item) => {
        const Icon = iconForKind(item.kind)
        return (
          <span
            key={item.id}
            className="inline-flex max-w-[min(180px,100%)] items-center gap-1 rounded-[var(--radius-full)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 py-[2px] text-[length:var(--font-size-xs)] text-[var(--text-secondary)]"
            data-testid="context-chip"
            data-item-id={item.id}
            data-tier={item.tier}
            title={item.title}
          >
            <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.title}</span>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={t('context.remove', { title: item.title })}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        )
      })}

      <button
        type="button"
        onClick={onAddCurrentTab}
        disabled={isAttaching}
        aria-label={t('context.addCurrentTab')}
        data-testid="context-add-tab"
        className="inline-flex min-h-[24px] items-center gap-1 rounded-[var(--radius-full)] border border-dashed border-[var(--border-strong)] px-2 py-[2px] text-[length:var(--font-size-xs)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-3 w-3" aria-hidden="true" />
        {t('context.addCurrentTabLabel')}
      </button>

      {onAttachSelection !== undefined && (
        <button
          type="button"
          onClick={onAttachSelection}
          disabled={isAttaching}
          aria-label={t('context.attachSelection')}
          data-testid="context-add-selection"
          className="inline-flex min-h-[24px] items-center gap-1 rounded-[var(--radius-full)] border border-dashed border-[var(--border-strong)] px-2 py-[2px] text-[length:var(--font-size-xs)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <MousePointer2 className="h-3 w-3" aria-hidden="true" />
          {t('context.attachSelectionLabel')}
        </button>
      )}
    </div>
  )
}
