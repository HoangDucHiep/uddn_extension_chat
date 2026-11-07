import { CircleHelp, History, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface PanelHeaderProps {
  provider?: string | undefined
  model?: string | undefined
  keySource?: string | undefined
  onClear: () => void
  /** Mo lai man hinh onboarding (FR-UX-02 — T-M1-25). */
  onOpenOnboarding?: (() => void) | undefined
  /** Mo drawer danh sach cuoc tro chuyen (FR-CHAT-09 — T-M1-09). */
  onOpenConversations?: (() => void) | undefined
  /** Tieu de conversation hien tai (hien thi trong header). */
  conversationTitle?: string | undefined
}

/**
 * Header cua side panel.
 * DP-6 — luon hien thi provider/model/nguon key de user tin tuong.
 */
export function PanelHeader({
  provider,
  model,
  keySource,
  onClear,
  onOpenOnboarding,
  onOpenConversations,
  conversationTitle,
}: PanelHeaderProps) {
  return (
    <header
      className="flex h-[var(--header-height)] items-center justify-between gap-2 border-b border-[var(--border-default)] bg-[var(--surface-panel)] px-[var(--space-3)]"
      data-testid="panel-header"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-[length:var(--font-size-md)] font-semibold text-[var(--text-primary)]">
          Sidekick AI
        </span>
        {conversationTitle !== undefined && conversationTitle.length > 0 ? (
          <span
            className="min-w-0 truncate text-[length:var(--font-size-sm)] text-[var(--text-secondary)]"
            data-testid="conversation-title"
            title={conversationTitle}
          >
            {conversationTitle}
          </span>
        ) : null}
        {provider ? (
          <span
            className="truncate rounded-[var(--radius-full)] bg-[var(--color-accent-subtle)] px-2 py-0.5 text-[length:var(--font-size-xs)] text-[var(--color-accent-hover)]"
            data-testid="provider-chip"
          >
            {provider}
            {model ? ` · ${model}` : ''}
            {keySource ? ` · ${keySource}` : ''}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        {onOpenConversations ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onOpenConversations}
            aria-label="Xem lich su cuoc tro chuyen"
            data-testid="conversations-button"
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : null}

        {onOpenOnboarding ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onOpenOnboarding}
            aria-label="Mo huong dan"
            data-testid="help-button"
          >
            <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClear}
          aria-label="Xoa cuoc tro chuyen"
          data-testid="clear-button"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </header>
  )
}
