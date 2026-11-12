import { ChevronDown } from 'lucide-react'
import { IconButton } from '@/components/ui/icon-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from '@/sidepanel/hooks/useI18n'

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
  const { t } = useI18n()

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[var(--space-3)] flex justify-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            variant="outline"
            onClick={onScrollToBottom}
            aria-label={t('chat.scrollToBottom')}
            data-testid="scroll-to-bottom"
            className="pointer-events-auto shadow-[var(--shadow-2)]"
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </TooltipTrigger>
        <TooltipContent>{t('chat.scrollToBottom')}</TooltipContent>
      </Tooltip>
    </div>
  )
}
