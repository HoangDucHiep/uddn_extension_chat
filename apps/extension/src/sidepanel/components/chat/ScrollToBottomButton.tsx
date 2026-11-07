import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface ScrollToBottomButtonProps {
  /** Handler khi bam nut. */
  onScrollToBottom: () => void
}

/**
 * Nut "Cuon xuong" (FR-UX-05 — T-M1-10).
 *
 * Chi hien khi thread khong o day → user dang doc phan tren.
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.3
 */
export function ScrollToBottomButton({ onScrollToBottom }: ScrollToBottomButtonProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[var(--space-3)] flex justify-center">
      <Button
        variant="outline"
        size="icon"
        onClick={onScrollToBottom}
        aria-label="Cuon xuong cuoi hoi thoai"
        data-testid="scroll-to-bottom"
        className="pointer-events-auto shadow-[var(--shadow-2)]"
      >
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  )
}
