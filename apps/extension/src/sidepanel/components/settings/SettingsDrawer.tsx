import { toast } from 'sonner'
import type { Settings } from '@sidekick/shared'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import { useSettings } from '@/sidepanel/hooks/useSettings'
import { AppearanceSettings } from './AppearanceSettings'
import { BudgetSettings } from './BudgetSettings'
import { DataSettings } from './DataSettings'
import { EndpointSettings } from './EndpointSettings'
import { LanguageSettings } from './LanguageSettings'
import { McpSettings } from './McpSettings'
import { PrivacySettings } from './PrivacySettings'
import { ShortcutsSettings } from './ShortcutsSettings'
import { ThemeSettings } from './ThemeSettings'
import { UsageSettings } from './UsageSettings'

/**
 * Drawer cai dat (FR-SETTINGS-01..07 + FR-UX-06 + NFR-SEC-07 — T-M1-12).
 *
 * Radix `Dialog` **truot tu phai** — giu nguyen context chat phia sau
 * (DP-2: thread >= 90%). Moi thay doi ap dung **ngay** (khong can reload)
 * qua `useSettings()`.
 *
 * T-M1-17: `settings` / `onSettingsChange` nhan tu `App.tsx` (vi tri cao
 * hon) de **ngon ngu** la nguon su that duy nhat cho ca panel — drawer
 * va thread doi ngon nung cung luc, khong phai 2 vung state doc lap.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.14 · docs/DESIGN_SYSTEM_BRIEF.md §3.7
 */
export interface SettingsDrawerProps {
  /** Drawer co mo hay khong. */
  open: boolean
  /** Dong / mo drawer. */
  onOpenChange: (open: boolean) => void
  /**
   * Cai dat hien tai.
   *
   * Bo trong → drawer tu doc `useSettings()` (dung cho test/doc lap).
   */
  settings?: Settings
  /**
   * Cap nhat mot phan cai dat → luu ngay + ap dung ngay.
   *
   * Bo trong → drawer tu ghi qua `useSettings()`.
   */
  onSettingsChange?: (patch: Partial<Settings>) => Promise<void>
  /** Callback sau khi xoa lich su chat (lam moi danh sach conversation). */
  onHistoryDeleted?: () => void
}

export function SettingsDrawer({
  open,
  onOpenChange,
  settings: settingsProp,
  onSettingsChange: onSettingsChangeProp,
  onHistoryDeleted,
}: SettingsDrawerProps) {
  const { t } = useI18n()

  // Fallback khi khong truyen props → drawer van dung lap doc lap.
  const local = useSettings()
  const settings = settingsProp ?? local.settings
  const onSettingsChange = onSettingsChangeProp ?? local.update

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={[
          'left-auto right-0 border-l border-r-0',
          // `min()` + `max-w-full` → drawer khong tran ngang khi panel
          // be 320px (FR-UX-06 — T-M1-20).
          'w-[min(360px,92vw)] max-w-full',
          'data-[state=open]:animate-drawer-in-right',
        ].join(' ')}
        data-testid="settings-drawer"
      >
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogDescription>{t('settings.description')}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-[var(--space-3)] pb-[var(--space-4)] pt-[var(--space-2)]">
          <ThemeSettings
            theme={settings.theme}
            onChange={(theme) => {
              onSettingsChange({ theme })
            }}
          />

          <AppearanceSettings
            fontScale={settings.fontScale}
            density={settings.density}
            panelWidth={settings.panelWidth}
            onFontScaleChange={(fontScale) => {
              onSettingsChange({ fontScale })
            }}
            onDensityChange={(density) => {
              onSettingsChange({ density })
            }}
            onPanelWidthChange={(panelWidth) => {
              onSettingsChange({ panelWidth })
            }}
          />

          <PrivacySettings
            telemetryEnabled={settings.telemetryEnabled}
            historyEnabled={settings.historyEnabled}
            onTelemetryChange={(telemetryEnabled) => {
              onSettingsChange({ telemetryEnabled })
            }}
            onHistoryChange={(historyEnabled) => {
              onSettingsChange({ historyEnabled })
            }}
          />

          {/* Chi phi & su dung (T-M2-03 — FR-PROVIDER-05). */}
          <UsageSettings />

          {/* Ngan sach chi phi (T-M2-03b — FR-PROVIDER-06). */}
          <BudgetSettings />

          {/* MCP server (T-M2-08 — FR-TOOLS-01). */}
          <McpSettings />

          <DataSettings {...(onHistoryDeleted !== undefined ? { onHistoryDeleted } : {})} />

          <EndpointSettings
            bffUrl={settings.bffUrl}
            onSave={async (bffUrl) => {
              await onSettingsChange({ bffUrl })
            }}
            onSuccess={(message) => {
              toast.success(message)
            }}
            onError={(message) => {
              toast.error(message)
            }}
          />

          <LanguageSettings
            uiLanguage={settings.uiLanguage}
            onChange={(uiLanguage) => {
              onSettingsChange({ uiLanguage })
            }}
          />

          {/* T-M1-18: phim tat — luu trong Chrome qua `chrome.commands`. */}
          <ShortcutsSettings />
        </div>
      </DialogContent>
    </Dialog>
  )
}
