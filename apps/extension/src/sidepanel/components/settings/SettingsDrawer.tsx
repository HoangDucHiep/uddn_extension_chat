import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSettings } from '@/sidepanel/hooks/useSettings'
import { AppearanceSettings } from './AppearanceSettings'
import { DataSettings } from './DataSettings'
import { EndpointSettings } from './EndpointSettings'
import { LanguageSettings } from './LanguageSettings'
import { PrivacySettings } from './PrivacySettings'
import { ThemeSettings } from './ThemeSettings'

/**
 * Drawer cai dat (FR-SETTINGS-01..07 + FR-UX-06 + NFR-SEC-07 — T-M1-12).
 *
 * Radix `Dialog` **truot tu phai** — giu nguyen context chat phia sau
 * (DP-2: thread >= 90%). Moi thay doi ap dung **ngay** (khong can reload)
 * qua `useSettings()`.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.14 · docs/DESIGN_SYSTEM_BRIEF.md §3.7
 */
export interface SettingsDrawerProps {
  /** Drawer co mo hay khong. */
  open: boolean
  /** Dong / mo drawer. */
  onOpenChange: (open: boolean) => void
  /** Callback sau khi xoa lich su chat (lam moi danh sach conversation). */
  onHistoryDeleted?: () => void
}

export function SettingsDrawer({ open, onOpenChange, onHistoryDeleted }: SettingsDrawerProps) {
  const { settings, update } = useSettings()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={[
          'left-auto right-0 border-l border-r-0',
          'w-[min(360px,92vw)] max-w-[min(360px,92vw)]',
          'data-[state=open]:animate-drawer-in-right',
        ].join(' ')}
        data-testid="settings-drawer"
      >
        <DialogHeader>
          <DialogTitle>Cài đặt</DialogTitle>
          <DialogDescription>
            Thay đổi có hiệu lực ngay và được giữ khi bạn đóng panel.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-[var(--space-3)] pb-[var(--space-4)] pt-[var(--space-2)]">
          <ThemeSettings
            theme={settings.theme}
            onChange={(theme) => {
              void update({ theme })
            }}
          />

          <AppearanceSettings
            fontScale={settings.fontScale}
            density={settings.density}
            panelWidth={settings.panelWidth}
            onFontScaleChange={(fontScale) => {
              void update({ fontScale })
            }}
            onDensityChange={(density) => {
              void update({ density })
            }}
            onPanelWidthChange={(panelWidth) => {
              void update({ panelWidth })
            }}
          />

          <PrivacySettings
            telemetryEnabled={settings.telemetryEnabled}
            historyEnabled={settings.historyEnabled}
            onTelemetryChange={(telemetryEnabled) => {
              void update({ telemetryEnabled })
            }}
            onHistoryChange={(historyEnabled) => {
              void update({ historyEnabled })
            }}
          />

          <DataSettings {...(onHistoryDeleted !== undefined ? { onHistoryDeleted } : {})} />

          <EndpointSettings
            bffUrl={settings.bffUrl}
            onSave={async (bffUrl) => {
              await update({ bffUrl })
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
              void update({ uiLanguage })
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
