import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/useI18n'

/**
 * Dialog — shadcn/ui (copy vao repo).
 * Dung design token, khong hardcode mau.
 *
 * Radix Dialog render qua Portal → khong bi `overflow` cua thread chat cat.
 * Dung cho drawer danh sach cuoc tro chuyen (T-M1-09) + confirm xoa.
 */

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-[var(--surface-sunken)]/70 backdrop-blur-[1px]',
      'data-[state=open]:animate-fade-in',
      className,
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  // Nhan nut dong phai dich theo ngon ngu UI (T-M1-17 — FR-SETTINGS-06).
  const { t } = useI18n()

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-[min(320px,85vw)] max-w-full flex-col',
          'border-r border-[var(--border-default)] bg-[var(--surface-overlay)]',
          'text-[var(--text-primary)] shadow-[var(--shadow-3)]',
          'focus:outline-none data-[state=open]:animate-drawer-in',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className={cn(
            'absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)]',
            'text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)]',
            'hover:text-[var(--text-primary)] focus-visible:outline-2',
            'focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
          )}
          aria-label={t('common.close')}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement => (
  <div className={cn('flex flex-col gap-1', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement => (
  <div
    className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
    {...props}
  />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-[length:var(--font-size-lg)] font-semibold text-[var(--text-primary)]',
      className,
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-[length:var(--font-size-sm)] text-[var(--text-secondary)]', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
