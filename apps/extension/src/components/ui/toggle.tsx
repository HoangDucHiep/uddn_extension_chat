import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Toggle — công tắc dạng **pill** (T-M3-POLISH §7.31).
 *
 * Khác `Switch` (dạng track + knob lớn): toggle pill ở dạng
 * "nút bấm có 2 trạng thái" — dùng cho các lựa chọn kiểu on/off nhỏ
 * (bật telemetry, bật auto-scroll, lọc tag).
 *
 * Dùng `<button role="switch" aria-checked>` → screen reader đọc đúng
 * trạng thái bật/tắt.
 */

export interface ToggleProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  /** Trạng thái bật. */
  checked: boolean
  /** Callback khi đổi trạng thái. */
  onCheckedChange?: (checked: boolean) => void
}

export const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        onCheckedChange?.(!checked)
      }}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-full)] px-2.5 py-1',
        'text-[length:var(--font-size-xs)] font-medium leading-tight',
        'transition-colors duration-fast ease-standard',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
        'disabled:pointer-events-none disabled:opacity-50',
        checked
          ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
          : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)]',
        className,
      )}
      {...props}
    />
  ),
)
Toggle.displayName = 'Toggle'
