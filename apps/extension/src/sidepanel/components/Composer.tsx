import { Loader2, Send, Square } from 'lucide-react'
import { type ChangeEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export interface ComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
}

/**
 * Composer — o nhap cau hoi.
 * Auto-grow theo noi dung, gioi han theo `--composer-min-height` / `--composer-max-height`.
 */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  disabled = false,
}: ComposerProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
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
  }

  return (
    <div
      className="border-t border-[var(--border-default)] bg-[var(--surface-panel)] p-[var(--space-3)]"
      data-testid="composer"
    >
      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={handleAutoGrow}
          onKeyDown={handleKeyDown}
          placeholder="Hoi Sidekick AI ve trang dang mo..."
          disabled={disabled}
          aria-label="Nhap cau hoi"
          data-testid="composer-input"
          className="max-h-[var(--composer-max-height)] min-h-[var(--composer-min-height)] flex-1"
        />

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
        Enter de gui · Shift+Enter de xuong dong
      </p>
    </div>
  )
}
