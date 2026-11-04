import { Loader2, Send, Square } from 'lucide-react'
import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

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
}: ComposerProps) {
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

  return (
    <div
      className="border-t border-[var(--border-default)] bg-[var(--surface-panel)] p-[var(--space-3)]"
      data-testid="composer"
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
            placeholder="Hoi Sidekick AI ve trang dang mo... (go @ de dinh kem tab)"
            disabled={disabled}
            aria-label="Nhap cau hoi"
            data-testid="composer-input"
            className="max-h-[var(--composer-max-height)] min-h-[var(--composer-min-height)] w-full"
          />
        </div>

        {isStreaming ? (
          <Button
            variant="outline"
            size="icon"
            onClick={onStop}
            aria-label="Dung tao cau tra loi"
            data-testid="composer-stop"
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={onSend}
            disabled={disabled || value.trim().length === 0}
            aria-label="Gui cau hoi"
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
