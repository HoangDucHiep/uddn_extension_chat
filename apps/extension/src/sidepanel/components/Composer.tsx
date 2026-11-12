import { Globe, Loader2, MousePointer2, Paperclip, Send, Square } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
  /**
   * Nut "Them trang nay" (dinh kem tab hien tai).
   *
   * `undefined` → khong render nut nay.
   */
  onAttachCurrentTab?: (() => void) | undefined
  /**
   * Popover chon **nhieu** tab (T-M3-POLISH — FR-CONTEXT-03).
   *
   * `undefined` → khong render trigger.
   */
  tabPicker?: ReactNode
  /**
   * Nut "Dinh doan da chon" (FR-CONTEXT-04 — T-M1-02).
   *
   * `undefined` → khong render nut nay.
   */
  onAttachSelection?: (() => void) | undefined
  /** Dang trich xuat context → vo hieu hoa cac nut dinh kem. */
  isAttaching?: boolean
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
  onAttachCurrentTab,
  tabPicker,
  onAttachSelection,
  isAttaching = false,
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
      {/*
        Card composer (T-M3-POLISH) — textarea bo trong 1 the bo vien,
        toolbar ben trong the duoi → dung 1 khoi gon nhat.
      */}
      <div
        className="rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-panel)] p-[var(--space-2)] transition-colors focus-within:border-[var(--border-focus)]"
        data-testid="composer-card"
      >
        <div className="relative min-w-0">
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

        <div className="mt-[var(--space-2)] flex items-center justify-between gap-2">
          {/* Toolbar trai — cac nut dinh kem dang pill. */}
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {tabPicker}

            {onAttachCurrentTab !== undefined ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onAttachCurrentTab}
                    disabled={disabled || isAttaching}
                    aria-label={t('context.addCurrentTab')}
                    data-testid="composer-add-tab"
                    className="inline-flex min-h-[28px] items-center gap-1 rounded-[var(--radius-full)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2.5 text-[length:var(--font-size-xs)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('context.addCurrentTabLabel')}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t('context.addCurrentTab')}</TooltipContent>
              </Tooltip>
            ) : null}

            {onAttachSelection !== undefined ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onAttachSelection}
                    disabled={disabled || isAttaching}
                    aria-label={t('context.attachSelection')}
                    data-testid="composer-add-selection"
                    className="inline-flex min-h-[28px] items-center gap-1 rounded-[var(--radius-full)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2.5 text-[length:var(--font-size-xs)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <MousePointer2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('context.attachSelectionLabel')}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t('context.attachSelection')}</TooltipContent>
              </Tooltip>
            ) : null}

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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={openFilePicker}
                      disabled={disabled || isReadingFiles}
                      aria-label={t('composer.attachFile')}
                      data-testid="composer-file-button"
                      className="inline-flex min-h-[28px] items-center gap-1 rounded-[var(--radius-full)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2.5 text-[length:var(--font-size-xs)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isReadingFiles ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {t('composer.attachFileLabel')}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('composer.attachFile')}</TooltipContent>
                </Tooltip>
              </>
            ) : null}
          </div>

          {/* Nut gui / dung — pill, dat trong card. */}
          {isStreaming ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onStop}
                  aria-label={t('composer.stop')}
                  data-testid="composer-stop"
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--radius-full)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-[length:var(--font-size-xs)] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-sunken)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
                >
                  <Square className="h-3 w-3" aria-hidden="true" />
                  {t('composer.stopLabel')}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('composer.stop')}</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onSend}
                  disabled={disabled || value.trim().length === 0}
                  aria-label={t('composer.send')}
                  data-testid="composer-send"
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--radius-full)] bg-[var(--color-accent)] px-3.5 text-[length:var(--font-size-xs)] font-medium text-[var(--color-accent-fg)] transition-colors hover:bg-[var(--color-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] disabled:pointer-events-none disabled:opacity-50"
                >
                  {disabled ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {t('composer.sendLabel')}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('composer.send')}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <p className="mt-2 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
        {t('composer.hint')}
      </p>
    </div>
  )
}
