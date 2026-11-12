import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Button — shadcn/ui (copy vao repo).
 * Dung design token, khong hardcode mau.
 *
 * Phong cach T-M3-POLISH:
 *  - `default` = **near-black** fill (CTA chinh) — khong con indigo.
 *  - `icon` = **tron** (circle) — nhan dang chuan cua side panel.
 *  - `pill` = **pill** (chip / toolbar).
 */

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ' +
    'transition-colors duration-fast ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 ' +
    'focus-visible:outline-[var(--border-focus)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-hover)]',
        secondary:
          'bg-[var(--surface-sunken)] text-[var(--text-primary)] hover:bg-[var(--surface-raised)]',
        outline:
          'border border-[var(--border-default)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]',
        ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]',
        danger: 'bg-[var(--danger)] text-[var(--text-inverse)] hover:opacity-90',
        /** Pill — vien day + nen nhat, dung cho chip/toolbar (T-M3-POLISH). */
        pill:
          'rounded-[var(--radius-full)] border border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-6',
        icon: 'h-9 w-9 rounded-full',
        'icon-sm': 'h-7 w-7 rounded-full',
        /** Pill nhỏ — chip trong toolbar composer. */
        'pill-sm': 'h-7 rounded-[var(--radius-full)] px-2.5 text-xs',
        'pill-md': 'h-8 rounded-[var(--radius-full)] px-3 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
