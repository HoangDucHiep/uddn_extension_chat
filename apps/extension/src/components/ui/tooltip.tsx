import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

/**
 * Tooltip — Radix UI wrapper (T-M3-POLISH §7.31).
 *
 * ## Vì sao cần?
 *
 * Yêu cầu thiết kế: **mọi nút bấm / icon phải có tooltip giải thích**.
 * Radix Tooltip xử lý sẵn: delay, vị trí, escape đóng, focus + hover.
 *
 * ## A11y
 *
 * Tooltip Radik **không** thay thế `aria-label`. Mỗi nút vẫn phải có
 * `aria-label` (đọc bằng screen reader khi không hover). Tooltip chỉ
 * là lớp trợ giúp thị giác.
 *
 * ## Provider
 *
 * `Tooltip` **tự bọc** `TooltipProvider` bên trong → component dùng được
 * độc lập (test, drawer, onboarding) mà không cần provider ở gốc cây.
 * Radix cho phép provider lồng nhau → provider ở `App.tsx` vẫn hoạt
 * động bình thường.
 *
 * Dùng:
 *
 * ```tsx
 * <Tooltip>
 *   <TooltipTrigger asChild>
 *     <button aria-label="Gửi" className="h-8 w-8">…</button>
 *   </TooltipTrigger>
 *   <TooltipContent>Gửi tin nhắn</TooltipContent>
 * </Tooltip>
 * ```
 */
const TooltipProvider = TooltipPrimitive.Provider

/**
 * Root cua tooltip — tu boc provider de dung doc lap.
 */
const Tooltip = ({
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) => (
  <TooltipPrimitive.Provider delayDuration={400} skipDelayDuration={200}>
    <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>
  </TooltipPrimitive.Provider>
)

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={8}
      className={cn(
        'z-[60] max-w-[240px] rounded-[var(--radius-sm)] border border-[var(--border-default)]',
        'bg-[var(--surface-overlay)] px-2 py-1 text-[length:var(--font-size-xs)] leading-snug',
        'text-[var(--text-primary)] shadow-[var(--shadow-2)]',
        'data-[state=delayed-open]:animate-fade-in',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
