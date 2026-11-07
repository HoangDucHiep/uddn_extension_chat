import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/**
 * Confirm dialog (FR-CHAT-08 — "Xoá cả nhóm → có confirm dialog").
 *
 * Dung chung cho xoa cuoc tro chuyen / hanh dong pha huy.
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.6
 */
export interface ConfirmDialogProps {
  /** Dialog co mo hay khong. */
  open: boolean
  /** Tieu de (can thiết cho a11y). */
  title: string
  /** Mo ta them cho nguoi dung. */
  description?: string
  /** Nhan nut xac nhan. */
  confirmLabel?: string
  /** Nhan nut huy. */
  cancelLabel?: string
  /** Co dung nut nguy hiem (mau do) hay khong. */
  destructive?: boolean
  /** Dong dialog. */
  onOpenChange: (open: boolean) => void
  /** Xac nhan → thuc hien hanh dong. */
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Huỷ',
  destructive = false,
  onOpenChange,
  onConfirm,
}: ConfirmDialogProps) {
  const [isBusy, setIsBusy] = useState(false)

  const handleConfirm = async (): Promise<void> => {
    setIsBusy(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="left-1/2 top-1/2 h-auto w-[min(320px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-[var(--border-default)]"
        data-testid="confirm-dialog"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description !== undefined ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <DialogFooter className="mt-[var(--space-3)]">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
            data-testid="confirm-cancel"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'default'}
            size="sm"
            onClick={() => {
              void handleConfirm()
            }}
            disabled={isBusy}
            data-testid="confirm-accept"
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
