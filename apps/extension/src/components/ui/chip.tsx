import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Chip — pill nhỏ dùng để hiển thị nhãn / trạng thái (T-M3-POLISH §7.31).
 *
 * Dùng cho: provider badge, model pill, tag, context chip (tab/file/ảnh),
 * trạng thái tool call. Bo tròn hoàn toàn (`rounded-full`) — ngôn ngữ
 * hình ảnh "pill" của ảnh tham chiếu.
 */

export type ChipTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Sắc thái màu — ánh xạ sang design token, không hardcode. */
  tone?: ChipTone
}

const TONE_CLASS: Record<ChipTone, string> = {
  neutral: 'bg-[var(--surface-sunken)] text-[var(--text-secondary)]',
  accent: 'bg-[var(--color-accent-subtle)] text-[var(--text-primary)]',
  success: 'bg-[var(--success-subtle)] text-[var(--success)]',
  warning: 'bg-[var(--warning-subtle)] text-[var(--warning)]',
  danger: 'bg-[var(--danger-subtle)] text-[var(--danger)]',
  info: 'bg-[var(--info-subtle)] text-[var(--info)]',
}

export const Chip = React.forwardRef<HTMLSpanElement, ChipProps>(
  ({ className, tone = 'neutral', ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-[var(--radius-full)] px-2 py-0.5',
        'text-[length:var(--font-size-xs)] font-medium leading-tight',
        TONE_CLASS[tone],
        className,
      )}
      {...props}
    />
  ),
)
Chip.displayName = 'Chip'
