import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/sidepanel/components/chat/ConfirmDialog'
import { deleteAllConversations } from '@/lib/conversationClient'
import { deleteLocalSidekickData, exportSettings, importSettings } from '@/lib/settings'
import { downloadTextFile } from '@/lib/downloadFile'
import { useI18n } from '@/sidepanel/hooks/useI18n'

/**
 * Section quan ly du lieu (FR-SETTINGS-03/07 + NFR-SEC-07 — T-M1-12,
 * dich UI T-M1-17).
 *
 * - Xoa lich su chat → `DELETE /api/conversations` (server, cascade).
 * - Xoa du lieu local → xoa khoa `sidekick.` trong `chrome.storage.local`
 *   (giu nguyen trang thai onboarding).
 * - Export / import settings JSON.
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.7
 */
export interface DataSettingsProps {
  /** Callback lam moi danh sach conversation sau khi xoa lich su. */
  onHistoryDeleted?: () => void
}

type PendingAction = 'history' | 'local' | null

export function DataSettings({ onHistoryDeleted }: DataSettingsProps) {
  const { t } = useI18n()
  const [pending, setPending] = useState<PendingAction>(null)
  const [isBusy, setIsBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async (): Promise<void> => {
    try {
      const json = await exportSettings()
      downloadTextFile('sidekick-settings.json', json, 'application/json')
      toast.success(t('toast.settingsExported'))
    } catch {
      toast.error(t('toast.settingsExportFailed'))
    }
  }

  const handleImportFile = async (file: File): Promise<void> => {
    try {
      const text = await file.text()
      await importSettings(text)
      toast.success(t('toast.settingsImported'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('toast.settingsImportFailed'))
    }
  }

  const runDeleteHistory = async (): Promise<void> => {
    setIsBusy(true)
    try {
      const deleted = await deleteAllConversations()
      toast.success(t('toast.historyDeleted', { count: deleted }))
      onHistoryDeleted?.()
    } catch {
      toast.error(t('toast.historyDeleteFailed'))
    } finally {
      setIsBusy(false)
    }
  }

  const runDeleteLocal = async (): Promise<void> => {
    setIsBusy(true)
    try {
      const keys = await deleteLocalSidekickData()
      toast.success(t('toast.localDeleted', { count: keys.length }))
    } catch {
      toast.error(t('toast.localDeleteFailed'))
    } finally {
      setIsBusy(false)
    }
  }

  const handleConfirm = async (): Promise<void> => {
    if (pending === 'history') {
      await runDeleteHistory()
      return
    }
    if (pending === 'local') {
      await runDeleteLocal()
    }
  }

  return (
    <>
      <section className="space-y-2 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <h3 className="text-[length:var(--font-size-sm)] font-semibold text-[var(--text-primary)]">
            {t('settings.data.title')}
          </h3>
          <p className="mt-0.5 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
            {t('settings.data.description')}
          </p>
        </div>

        <div className="space-y-2 px-2">
          <Button
            type="button"
            variant="danger"
            size="sm"
            className="w-full"
            disabled={isBusy}
            onClick={() => {
              setPending('history')
            }}
            data-testid="settings-delete-history"
          >
            {t('settings.data.deleteHistory')}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isBusy}
            onClick={() => {
              setPending('local')
            }}
            data-testid="settings-delete-local"
          >
            {t('settings.data.deleteLocal')}
          </Button>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                void handleExport()
              }}
              data-testid="settings-export"
            >
              {t('settings.data.export')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                fileInputRef.current?.click()
              }}
              data-testid="settings-import"
            >
              {t('settings.data.import')}
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="settings-import-input"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file !== undefined) {
                void handleImportFile(file)
              }
            }}
          />

          <p className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
            {t('settings.data.localHint')}
          </p>
        </div>
      </section>

      <ConfirmDialog
        open={pending !== null}
        title={
          pending === 'local'
            ? t('settings.data.deleteLocalTitle')
            : t('settings.data.deleteHistoryTitle')
        }
        description={
          pending === 'local'
            ? t('settings.data.deleteLocalDescription')
            : t('settings.data.deleteHistoryDescription')
        }
        confirmLabel={t('common.delete')}
        destructive
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
        onConfirm={handleConfirm}
      />
    </>
  )
}
