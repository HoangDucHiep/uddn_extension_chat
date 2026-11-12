import type { ReactNode } from 'react'
import { CircleHelp, History, Settings, Sparkles, Trash2 } from 'lucide-react'
import { IconButton } from '@/components/ui/icon-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import { ConnectionBadge } from './states/ConnectionBadge'
import type { ConnectionStatus } from '@/lib/connectionStatus'

export interface PanelHeaderProps {
  provider?: string | undefined
  model?: string | undefined
  keySource?: string | undefined
  onClear: () => void
  /** Mo lai manhinh onboarding (FR-UX-02 — T-M1-25). */
  onOpenOnboarding?: (() => void) | undefined
  /** Mo drawer danh sach cuoc tro chuyen (FR-CHAT-09 — T-M1-09). */
  onOpenConversations?: (() => void) | undefined
  /** Mo drawer quan ly skill (FR-SKILL-02/03 — T-M2-04). */
  onOpenSkills?: (() => void) | undefined
  /** Mo drawer cai dat (FR-SETTINGS-01..07 — T-M1-12). */
  onOpenSettings?: (() => void) | undefined
  /**
   * Node xuat cuoc tro chuyen (FR-CHAT-10 — T-M1-13).
   *
   * Truyen **node** (khong phai callback) de menu giu duoc trigger cua rieng
   * no — header chi lo vi tri, khong can biet chi tiet hành động.
   */
  exportMenu?: ReactNode
  /**
   * Node chon mo hinh AI (T-M2-02 — FR-PROVIDER-03).
   *
   * Cung truyen **node** de picker giu duoc trigger cua rieng no.
   */
  modelPicker?: ReactNode
  /** Tieu de conversation hien tai (hien thi trong header). */
  conversationTitle?: string | undefined
  /** Trang thai ket noi toi BFF (NFR-REL-04 — T-M1-19). */
  connectionStatus?: ConnectionStatus | undefined
}

/**
 * Header cua side panel.
 * DP-6 — luon hien thi provider/model/nguon key de user tin tuong.
 *
 * Phong cach T-M3-POLISH:
 *  - Logo mark bo goc + tieu de ben trai.
 *  - Cu cluster ben phai: **nut tron (ghost)** + tooltip cho moi nut.
 *  - Provider chip la **pill trung tinh** (khong phai mau accent — accent
 *    nay near-black nen mau accent se doc nhu "bam vao").
 */
export function PanelHeader({
  provider,
  model,
  keySource,
  onClear,
  onOpenOnboarding,
  onOpenConversations,
  onOpenSkills,
  onOpenSettings,
  exportMenu,
  modelPicker,
  conversationTitle,
  connectionStatus,
}: PanelHeaderProps) {
  const { t } = useI18n()

  return (
    <header
      className="flex h-[var(--header-height)] items-center justify-between gap-2 border-b border-[var(--border-default)] bg-[var(--surface-panel)] px-[var(--space-3)]"
      data-testid="panel-header"
    >
      <div className="flex min-w-0 items-center gap-2">
        {/* Logo mark — hinh vuong bo goc, dung design token. */}
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[length:var(--font-size-xs)] font-bold text-[var(--color-accent-fg)]"
          aria-hidden="true"
          data-testid="panel-logo-mark"
        >
          S
        </span>
        <span className="text-[length:var(--font-size-md)] font-semibold text-[var(--text-primary)]">
          {t('header.title')}
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
            className="truncate rounded-[var(--radius-full)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 py-0.5 text-[length:var(--font-size-xs)] text-[var(--text-secondary)]"
            data-testid="provider-chip"
          >
            {provider}
            {model ? ` · ${model}` : ''}
            {keySource ? ` · ${keySource}` : ''}
          </span>
        ) : null}
        {connectionStatus !== undefined ? <ConnectionBadge status={connectionStatus} /> : null}
      </div>

      <div className="flex items-center gap-0.5">
        {modelPicker !== undefined ? modelPicker : null}

        {onOpenConversations ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                size="sm"
                onClick={onOpenConversations}
                aria-label={t('header.openConversations')}
                data-testid="conversations-button"
              >
                <History className="h-3.5 w-3.5" aria-hidden="true" />
              </IconButton>
            </TooltipTrigger>
            <TooltipContent>{t('header.openConversations')}</TooltipContent>
          </Tooltip>
        ) : null}

        {onOpenSkills ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                size="sm"
                onClick={onOpenSkills}
                aria-label={t('header.openSkills')}
                data-testid="skills-button"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              </IconButton>
            </TooltipTrigger>
            <TooltipContent>{t('header.openSkills')}</TooltipContent>
          </Tooltip>
        ) : null}

        {exportMenu !== undefined ? exportMenu : null}

        {onOpenOnboarding ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                size="sm"
                onClick={onOpenOnboarding}
                aria-label={t('header.openGuide')}
                data-testid="help-button"
              >
                <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
              </IconButton>
            </TooltipTrigger>
            <TooltipContent>{t('header.openGuide')}</TooltipContent>
          </Tooltip>
        ) : null}

        {onOpenSettings ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                size="sm"
                onClick={onOpenSettings}
                aria-label={t('header.openSettings')}
                data-testid="settings-button"
              >
                <Settings className="h-3.5 w-3.5" aria-hidden="true" />
              </IconButton>
            </TooltipTrigger>
            <TooltipContent>{t('header.openSettings')}</TooltipContent>
          </Tooltip>
        ) : null}

        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton
              size="sm"
              onClick={onClear}
              aria-label={t('header.clearConversation')}
              data-testid="clear-button"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </IconButton>
          </TooltipTrigger>
          <TooltipContent>{t('header.clearConversation')}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
