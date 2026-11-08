import { ImagePlus, Loader2, Send, Square } from 'lucide-react'
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
   * Callback khi user chon file anh (FR-VISION-01 — T-M1-24).
   *
   * Dinh huong tu file picker / drag-drop / paste → cung mot handler.
   */
  onImagesSelected?: (files: readonly File[]) => void
  /** Dang doc file anh → hien spinner tren nut. */
  isReadingImages?: boolean
}

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  disabled = false,
  mentionPopover,
  onCursorChange,
  onEscape,
  inputRef,
  onImagesSelected,
  isReadingImages = false,
}: ComposerProps) {
  const { t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Escape → dong popover `@` truoc (khong chan event de panel khong bi vung).
    if (event.key === 'Escape') {
      onEscape?.()
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

  // Paste anh tu clipboard → dinh kem (FR-VISION-01 — T-M1-24).
  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>): void => {
    if (onImagesSelected === undefined) return
    const files = event.clipboardData?.files
    if (files === undefined || files === null || files.length === 0) return
    const images = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (images.length === 0) return
    event.preventDefault()
    onImagesSelected(images)
  }

  // Drag & drop anh vao composer (FR-VISION-01 — T-M1-24).
  //
  // `preventDefault()` bat buoc — neu khong, Chrome se dieu huong panel di
  // khoi trang khi user tha file.
  const handleDragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (onImagesSelected === undefined) return
    event.preventDefault()
    // `dataTransfer` co the undefined (mot so trinh duyet / test env) →
    // chi set `dropEffect` khi co dataTransfer.
    if (event.dataTransfer !== undefined && event.dataTransfer !== null) {
      event.dataTransfer.dropEffect = 'copy'
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    if (onImagesSelected === undefined) return
    event.preventDefault()
    const files = event.dataTransfer?.files
    if (files === undefined || files === null) return
    const images = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (images.length === 0) return
    onImagesSelected(images)
  }

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = event.target.files
    if (files !== null && files.length > 0) {
      onImagesSelected?.(Array.from(files))
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
        <div className="relative flex-1">
          {mentionPopover}
          <Textarea
            ref={inputRef}
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

        {onImagesSelected !== undefined ? (
          <>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={handleFileInput}
              data-testid="composer-file-input"
              aria-label={t('composer.pickImage')}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={openFilePicker}
              disabled={disabled || isReadingImages}
              aria-label={t('composer.attachImage')}
              data-testid="composer-image-button"
            >
              {isReadingImages ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
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
            <Square className="h-4 w-4" />
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
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      <p className="mt-2 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
        Enter de gui · Shift+Enter de xuong dong · @ de dinh kem tab
      </p>
    </div>
  )
}
