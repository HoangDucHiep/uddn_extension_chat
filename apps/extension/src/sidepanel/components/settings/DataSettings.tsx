import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/sidepanel/components/chat/ConfirmDialog'
import { deleteAllConversations } from '@/lib/conversationClient'
import { deleteLocalSidekickData, exportSettings, importSettings } from '@/lib/settings'

/**
 * Section quan ly du lieu (FR-SETTINGS-03/07 + NFR-SEC-07 — T-M1-12).
 *
 * - Xoa lich su chat → `DELETE /api/conversations` (server, cascade).
 * - Xoa du lieu local → xoa khoa `sidekick.` trong `chrome.storage.local`
 *   (giu nguyên trang thai onboarding).
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
  const [pending, setPending] = useState<PendingAction>(null)
  const [isBusy, setIsBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async (): Promise<void> => {
    try {
      const json = await exportSettings()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'sidekick-settings.json'
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      toast.success('Đã xuất cài đặt')
    } catch {
      toast.error('Không xuất được cài đặt')
    }
  }

  const handleImportFile = async (file: File): Promise<void> => {
    try {
      const text = await file.text()
      await importSettings(text)
      toast.success('Đã nhập cài đặt')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không nhập được cài đặt')
    }
  }

  const runDeleteHistory = async (): Promise<void> => {
    setIsBusy(true)
    try {
      const deleted = await deleteAllConversations()
      toast.success(`Đã xoá lịch sử (${deleted} cuộc trò chuyện)`)
      onHistoryDeleted?.()
    } catch {
      toast.error('Không xoá được lịch sử chat')
    } finally {
      setIsBusy(false)
    }
  }

  const runDeleteLocal = async (): Promise<void> => {
    setIsBusy(true)
    try {
      const keys = await deleteLocalSidekickData()
      toast.success(`Đã xoá dữ liệu cục bộ (${keys.length} mục)`)
    } catch {
      toast.error('Không xoá được dữ liệu cục bộ')
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
            Quản lý dữ liệu
          </h3>
          <p className="mt-0.5 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
            Xoá lịch sử chat trên máy chủ, dọn bộ nhớ tạm cục bộ, hoặc sao lưu cài đặt.
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
            Xoá lịch sử chat
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
            Xoá dữ liệu cục bộ
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
              Xuất cài đặt
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
              Nhập cài đặt
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
            Xoá dữ liệu cục bộ sẽ xoá cache trang, bản nháp và lựa chọn đang chờ. Trạng thái
            onboarding và provider đã chọn vẫn được giữ.
          </p>
        </div>
      </section>

      <ConfirmDialog
        open={pending !== null}
        title={pending === 'local' ? 'Xoá dữ liệu cục bộ?' : 'Xoá toàn bộ lịch sử chat?'}
        description={
          pending === 'local'
            ? 'Mọi cache trang, bản nháp và lựa chọn đang chờ sẽ bị xoá. Không thể hoàn tác.'
            : 'Toàn bộ cuộc trò chuyện, tin nhắn và trích dẫn trên máy chủ sẽ bị xoá. Không thể hoàn tác.'
        }
        confirmLabel="Xoá"
        destructive
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
        onConfirm={handleConfirm}
      />
    </>
  )
}
