import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'

/**
 * Popover — shadcn/ui (copy vao repo).
 * Dung design token, khong hardcode mau.
 *
 * Radix Popover render qua Portal → khong bi `overflow` cua thread chat
 * cat (FR-CONTEXT-10 — T-M1-08).
 *
 * Phong cach T-M3-POLISH: phong "flat" → vien 1px + surface-overlay,
 * **khong** vien day. Boi shadow nhe (`--shadow-2`) de tach khoi nen
 * khi panel dung noi dung dung.
 */

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverPortal = PopoverPrimitive.Portal

const PopoverClose = PopoverPrimitive.Close

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 6, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={8}
      className={cn(
        'z-50 max-w-[min(320px,calc(100vw-16px))] rounded-[var(--radius-md)] border border-[var(--border-default)] ' +
          'bg-[var(--surface-overlay)] p-[var(--space-3)] text-[var(--text-primary)] ' +
          'shadow-[var(--shadow-2)] focus:outline-none',
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverClose, PopoverPortal }
