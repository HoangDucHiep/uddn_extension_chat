import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Textarea — shadcn/ui (copy vao repo).
 * Tu resize theo noi dung (auto-grow) trong Composer.
 */

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)]',
      'px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
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
