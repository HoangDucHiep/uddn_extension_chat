import * as React from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

/**
 * IconButton — nút **tròn** chỉ chứa icon (T-M3-POLISH §7.31).
 *
 * ## Vì sao cần primitive riêng?
 *
 * Yêu cầu thiết kế: nút icon trong side panel phải là **circle**
 * (`rounded-full`) + trạng thái **ghost** (nền trong suốt, hover mới có
 * nền). Đây là lối thiết kế lặp lại ở ~15 chỗ → gom vào 1 primitive để
 * không lệch nhau.
 *
 * ## A11y
 *
 * - `aria-label` là **bắt buộc** (props required) — không có text trong
 *   button thì screen reader không đọc được.
 * - Icon bên trong luôn `aria-hidden` — tránh đọc trùng.
 * - Focus ring dùng token `--border-focus`.
 *
 * ## Tooltip
 *
 * Truyen `tooltip` → component tu boc `Tooltip` (Radix provider da duoc
 * boc trong `Tooltip` root → dung doc lap duoc). Tooltip **bổ sung**,
 * không thay the `aria-label`.
 *
 * Dùng kèm `Tooltip` thu cong:
 *
 * ```tsx
 * <Tooltip>
 *   <TooltipTrigger asChild>
 *     <IconButton aria-label="Cài đặt">
 *       <Settings />
 *     </IconButton>
 *   </TooltipTrigger>
 *   <TooltipContent>Cài đặt</TooltipContent>
 * </Tooltip>
 * ```
 */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Nhãn accessible (bắt buộc — icon-only button). */
  'aria-label': string
  /** Kích thước: `sm` = 28px · `md` = 32px · `lg` = 36px. */
  size?: 'sm' | 'md' | 'lg'
  /** Trạng thái đang bật (dùng cho toggle icon). */
  active?: boolean
  /** Kiểu hiển thị. */
  variant?: 'ghost' | 'outline' | 'solid'
  /**
   * Nội dung tooltip (tuỳ chọn).
   *
   * `undefined` → không render tooltip (dùng khi nút nằm trong popover
   * đã có nhãn text rõ ràng).
   */
  tooltip?: string | undefined
}

const SIZE_CLASS = {
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
  lg: 'h-9 w-9',
} as const

const VARIANT_CLASS = {
  ghost:
    'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]',
  outline:
    'border border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]',
  solid: 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-hover)]',
} as const

const ACTIVE_CLASS = 'bg-[var(--surface-sunken)] text-[var(--text-primary)]' as const

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { className, size = 'md', variant = 'ghost', active = false, tooltip, children, ...props },
    ref,
  ) => {
    const button = (
      <button
        ref={ref}
        type="button"
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-[var(--radius-full)]',
          'transition-colors duration-fast ease-standard',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
          'disabled:pointer-events-none disabled:opacity-50',
          SIZE_CLASS[size],
          VARIANT_CLASS[variant],
          active && VARIANT_CLASS[variant] === VARIANT_CLASS.ghost ? ACTIVE_CLASS : null,
          className,
        )}
        {...props}
      >
        <span aria-hidden="true" className="inline-flex items-center justify-center">
          {children}
        </span>
      </button>
    )

    if (tooltip === undefined) return button

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    )
  },
)
IconButton.displayName = 'IconButton'
