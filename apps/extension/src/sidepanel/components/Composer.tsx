import { Loader2, Paperclip, Send, Square } from 'lucide-react'
import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
  useRef,
} from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { isDocumentFile } from '@/lib/documentUpload'
import { useI18n } from '@/sidepanel/hooks/useI18n'

export interface ComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
  /**
   * Popover `@` — hien thi danh sach tab de dinh kem (T-M1-05).
   *
   * `undefined` → khong render popover (chua go `@`).
   */
  mentionPopover?: ReactNode
  /**
   * Popover `/` — hien thi danh sach skill de goi (T-M2-04, FR-SKILL-01).
   *
   * `undefined` → khong render popover (chua go `/`).
   */
  skillPopover?: ReactNode
  /**
   * Popover chon tab cho **skill co dieu kien tab** (FR-SKILL-06 — T-M2-21).
   *
   * `undefined` → khong render popover.
   */
  skillTabPopover?: ReactNode
  /**
   * Handler phim khi menu `/` dang mo.
   *
   * Tra ve `true` → Composer **khong** xu ly Enter/Tab (menu `/` lo).
   * Tra ve `false` → Composer xu ly binh thuong.
   *
   * @param event - Su kien phim cua textarea.
   */
  onSkillKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => boolean
  /**
   * Callback khi vi tri con tro thay doi (dung cho phat hien token `@`).
   *
   * @param value - Noi dung hien tai cua textarea.
   * @param cursor - Chi so ky tu cua con tro.
   */
  onCursorChange?: (value: string, cursor: number) => void
  /**
   * Callback khi nguoi dung bam phim `Escape` trong textarea.
   *
   * Dung de dong popover `@` truoc khi `Escape` bi vung toi panel.
   */
  onEscape?: () => void
  /**
   * Ref cua textarea — app dung de dua con tro ve dung vi tri sau khi
   * chuyen `@query` thanh `@ten tab`.
   */
  inputRef?: RefObject<HTMLTextAreaElement>
  /**
   * Callback khi user chon file (anh **hoac** tai lieu).
   *
   * FR-VISION-01 (T-M1-24) — anh dinh kem truc tiep vao cau hoi.
   * FR-CONTEXT-14 (T-M2-23) — tai lieu duoc parse o BFF roi dua vao context.
   *
   * Dinh huong tu file picker / drag-drop / paste → cung mot handler.
   */
  onFilesSelected?: (files: readonly File[]) => void
  /** Dang doc file (anh hoac tai lieu) → hien spinner tren nut. */
  isReadingFiles?: boolean
}

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  disabled = false,
  mentionPopover,
  skillPopover,
  skillTabPopover,
  onSkillKeyDown,
  onCursorChange,
  onEscape,
  inputRef,
  onFilesSelected,
  isReadingFiles = false,
}: ComposerProps) {
  const { t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Escape → dong popover `@` truoc (khong chan event de panel khong bi vung).
    if (event.key === 'Escape') {
      onEscape?.()
      return
    }

    // Menu `/` dang mo → menu lo phim truoc (Enter chon, Tab autocomplete).
    if (onSkillKeyDown?.(event) === true) {
      event.preventDefault()
      return
    }

    // Enter gui, Shift+Enter xuong dong.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (!isStreaming) onSend()
    }
  }

  const handleAutoGrow = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    const target = event.target
    target.style.height = 'auto'
    target.style.height = `${Math.min(target.scrollHeight, 240)}px`
    onChange(target.value)
    onCursorChange?.(target.value, target.selectionStart ?? target.value.length)
  }

  // Cap nhat vi tri con tro khi nguoi dung bam/chon mot phan text.
  const handleSelect = (event: SyntheticEvent<HTMLTextAreaElement>): void => {
    const target = event.currentTarget
    onCursorChange?.(target.value, target.selectionStart ?? target.value.length)
  }

  // Paste file tu clipboard → dinh kem (anh: FR-VISION-01 · tai lieu: FR-CONTEXT-14).
  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>): void => {
    if (onFilesSelected === undefined) return
    const files = event.clipboardData?.files
    if (files === undefined || files === null || files.length === 0) return
    // Chi nhan file (anh hoac tai lieu) — text thuong van duoc paste binh thuong.
    const picked = Array.from(files).filter(
      (file) => file.type.startsWith('image/') || isDocumentFile(file),
    )
    if (picked.length === 0) return
    event.preventDefault()
    onFilesSelected(picked)
  }

  // Drag & drop file vao composer (anh + tai lieu).
  //
  // `preventDefault()` bat buoc — neu khong, Chrome se dieu huong panel di
  // khoi trang khi user tha file.
  const handleDragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (onFilesSelected === undefined) return
    event.preventDefault()
    // `dataTransfer` co the undefined (mot so trinh duyet / test env) →
    // chi set `dropEffect` khi co dataTransfer.
    if (event.dataTransfer !== undefined && event.dataTransfer !== null) {
      event.dataTransfer.dropEffect = 'copy'
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    if (onFilesSelected === undefined) return
    event.preventDefault()
    const files = event.dataTransfer?.files
    if (files === undefined || files === null) return
    const picked = Array.from(files).filter(
      (file) => file.type.startsWith('image/') || isDocumentFile(file),
    )
    if (picked.length === 0) return
    onFilesSelected(picked)
  }

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = event.target.files
    if (files !== null && files.length > 0) {
      onFilesSelected?.(Array.from(files))
    }
    // Reset de chon lai cung file van tao su kien `change`.
    event.target.value = ''
  }

  const openFilePicker = (): void => {
    fileInputRef.current?.click()
  }

  return (
    <div
      className="border-t border-[var(--border-default)] bg-[var(--surface-panel)] p-[var(--space-3)]"
      data-testid="composer"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-end gap-2">
        <div className="relative min-w-0 flex-1">
          {mentionPopover}
          {skillPopover}
          {skillTabPopover}
          <Textarea
            ref={inputRef}
            id="sidekick-composer-input"
            value={value}
            onChange={handleAutoGrow}
            onKeyDown={handleKeyDown}
            onSelect={handleSelect}
            onClick={handleSelect}
            onPaste={handlePaste}
            placeholder={t('composer.placeholder')}
            disabled={disabled}
            aria-label={t('composer.inputLabel')}
            data-testid="composer-input"
            className="max-h-[var(--composer-max-height)] min-h-[var(--composer-min-height)] w-full"
          />
        </div>

        {onFilesSelected !== undefined ? (
          <>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp,image/gif,.pdf,.docx,.txt,.md,.csv"
              multiple
              className="hidden"
              onChange={handleFileInput}
              data-testid="composer-file-input"
              aria-label={t('composer.pickFile')}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={openFilePicker}
              disabled={disabled || isReadingFiles}
              aria-label={t('composer.attachFile')}
              data-testid="composer-file-button"
            >
              {isReadingFiles ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Paperclip className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </>
        ) : null}

        {isStreaming ? (
          <Button
            variant="outline"
            size="icon"
            onClick={onStop}
            aria-label={t('composer.stop')}
            data-testid="composer-stop"
          >
            <Square className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={onSend}
            disabled={disabled || value.trim().length === 0}
            aria-label={t('composer.send')}
            data-testid="composer-send"
          >
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        )}
      </div>

      <p className="mt-2 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
        {t('composer.hint')}
      </p>
    </div>
  )
}
