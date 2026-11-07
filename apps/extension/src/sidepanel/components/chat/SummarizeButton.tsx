import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Nut "Tom tat trang nay" (FR-UX-04 — T-M1-11).
 *
 * Bam 1 lan → tu dinh kem trang hien tai roi gui prompt tom tat.
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.3
 */
export interface SummarizeButtonProps {
  /** Handler khi bam nut. */
  onSummarize: () => void
  /** Dang gui → vo hieu hoa nut. */
  disabled?: boolean
}

/**
 * Nut chinh tom tat trang dang xem.
 */
export function SummarizeButton({ onSummarize, disabled = false }: SummarizeButtonProps) {
  return (
    <Button
      variant="default"
      size="sm"
      onClick={onSummarize}
      disabled={disabled}
      aria-label="Tóm tắt trang này"
      data-testid="summarize-button"
      className="w-full"
    >
      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
      Tóm tắt trang này
    </Button>
  )
}
