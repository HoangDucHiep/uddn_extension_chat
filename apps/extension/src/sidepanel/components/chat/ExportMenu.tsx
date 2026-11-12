import { ClipboardCopy, Download, FileJson, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { IconButton } from '@/components/ui/icon-button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import { downloadTextFile } from '@/lib/downloadFile'
import {
  buildExportFileName,
  buildJsonExport,
  buildMarkdownExport,
  type ExportConversation,
  type ExportMessage,
} from '@/lib/export'

/**
 * Menu xuất cuộc trò chuyện (FR-CHAT-10 — T-M1-13).
 *
 * 3 hành động:
 *  - **Sao chép Markdown** → clipboard (nhanh nhất, không cần file).
 *  - **Xuất .md** → file Markdown mở được bằng Notepad / Markdown viewer.
 *  - **Xuất .json** → file JSON kèm metadata đầy đủ (máy đọc được).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.20
 */
export interface ExportMenuProps {
  /** Id conversation (rỗng khi chat chưa tạo conversation trên server). */
  conversationId?: string | undefined
  /** Tiêu đề conversation (dùng cho tên file + heading Markdown). */
  title: string
  /** Các message cần xuất (đã lọc theo đường đi active). */
  messages: readonly ExportMessage[]
}

/** MIME type của từng định dạng export. */
const MIME_MARKDOWN = 'text/markdown;charset=utf-8'
const MIME_JSON = 'application/json;charset=utf-8'

/**
 * Menu xuất cuộc trò chuyện.
 *
 * @param props - Props cua menu.
 */
export function ExportMenu({ conversationId, title, messages }: ExportMenuProps) {
  const { t } = useI18n()

  // Khong co noi dung → khong tao menu (nut "Xoá" van la noi dung de
  // lam viec).
  if (messages.length === 0) return null

  const buildConversation = (): ExportConversation => ({
    ...(conversationId !== undefined ? { id: conversationId } : {}),
    title,
    messages,
  })

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(buildMarkdownExport(buildConversation()))
      toast.success(t('toast.exportCopied'))
    } catch {
      toast.error(t('toast.exportFailed'))
    }
  }

  const handleDownloadMarkdown = (): void => {
    try {
      const now = new Date()
      downloadTextFile(
        buildExportFileName(title, 'md', now),
        buildMarkdownExport({ ...buildConversation(), exportedAt: now }),
        MIME_MARKDOWN,
      )
      toast.success(t('toast.exportDone'))
    } catch {
      toast.error(t('toast.exportFailed'))
    }
  }

  const handleDownloadJson = (): void => {
    try {
      const now = new Date()
      const payload = buildJsonExport({ ...buildConversation(), exportedAt: now })
      downloadTextFile(
        buildExportFileName(title, 'json', now),
        JSON.stringify(payload, null, 2),
        MIME_JSON,
      )
      toast.success(t('toast.exportDone'))
    } catch {
      toast.error(t('toast.exportFailed'))
    }
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <IconButton
              size="sm"
              aria-label={t('chat.export')}
              data-testid="export-button"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
            </IconButton>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t('chat.export')}</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        className="p-[var(--space-1)]"
        data-testid="export-menu"
      >
        <ul className="flex flex-col">
          <li>
            <button
              type="button"
              onClick={() => {
                void handleCopy()
              }}
              className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-left text-[length:var(--font-size-sm)] text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
              data-testid="export-copy-markdown"
            >
              <ClipboardCopy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t('chat.exportCopy')}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={handleDownloadMarkdown}
              className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-left text-[length:var(--font-size-sm)] text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
              data-testid="export-download-markdown"
            >
              <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t('chat.exportMarkdown')}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-left text-[length:var(--font-size-sm)] text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
              data-testid="export-download-json"
            >
              <FileJson className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t('chat.exportJson')}
            </button>
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  )
}
