import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Textarea — shadcn/ui (copy vao repo).
 * Tu resize theo noi dung (auto-grow) trong Composer.
 *
 * Mac dinh **khong vien** (composer bo trong 1 card bao quanh) — muon
 * vien thi truyen class `border border-[var(--border-default)]` tu component
 * dung. Co so chu theo design token.
 */

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex w-full bg-transparent text-[length:var(--font-size-md)] text-[var(--text-primary)]',
      'placeholder:text-[var(--text-tertiary)]',
      'transition-colors duration-fast ease-standard',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'resize-none',
      className,
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

export { Textarea }
