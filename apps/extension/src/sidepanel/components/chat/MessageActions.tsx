import { Pencil, RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { variantLabel, type TurnMessage } from '@/lib/chatTurns'

export interface MessageActionsProps {
  /** Message dang hien thi. */
  message: TurnMessage
  /** So bien the cua turn (dung cho switcher "2/3"). */
  variants: readonly TurnMessage[]
  /** Bien the dang active cua turn. */
  activeVariant: TurnMessage | undefined
  /** Handler sinh lai cau tra loi (FR-CHAT-05). */
  onRegenerate?: (messageId: string) => void
  /** Handler sua & gui lai tin nhan user (FR-CHAT-06). */
  onEdit?: (messageId: string) => void
  /** Handler tiep tuc cau tra loi da bi stop (FR-CHAT-07). */
  onContinue?: (messageId: string) => void
  /** Handler chuyen bien the (FR-CHAT-05). */
  onSelectVariant?: (turnId: string, variantIndex: number) => void
  /** Dang stream → an nhanh thao tac phu thuoc trang thai. */
  isStreaming?: boolean
}

/**
 * Thanh thao tac tren message (T-M1-10).
 *
 * - User message: "Sua" → sua & gui lai (FR-CHAT-06).
 * - Assistant message: "Tao lai" (FR-CHAT-05) · "Tiep tuc" khi bi stop
 *   (FR-CHAT-07) · switcher bien the "2/3".
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.3
 */
export function MessageActions({
  message,
  variants,
  activeVariant,
  onRegenerate,
  onEdit,
  onContinue,
  onSelectVariant,
  isStreaming = false,
}: MessageActionsProps) {
  const isUser = message.role === 'user'
  const label = variantLabel(variants, activeVariant)
  const canSwitch = variants.length > 1 && message.turnId !== undefined

  // User message → chi co nut "Sua".
  if (isUser) {
    if (onEdit === undefined) return null
    return (
      <div className="mt-1 flex items-center gap-1" data-testid="message-actions">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            onEdit(message.id)
          }}
          aria-label="Sua tin nhan"
          data-testid="message-edit-button"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    )
  }

  const hasActions =
    onRegenerate !== undefined || onContinue !== undefined || canSwitch
  if (!hasActions) return null

  return (
    <div
      className="mt-1 flex items-center gap-1"
      data-testid="message-actions"
      data-role="assistant"
    >
      {onRegenerate !== undefined ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            onRegenerate(message.id)
          }}
          disabled={isStreaming}
          aria-label="Tao lai cau tra loi"
          data-testid="message-regenerate-button"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      ) : null}

      {message.aborted === true && onContinue !== undefined ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            onContinue(message.id)
          }}
          disabled={isStreaming}
          aria-label="Tiep tuc cau tra loi"
          data-testid="message-continue-button"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      ) : null}

      {canSwitch && label !== undefined && onSelectVariant !== undefined ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[length:var(--font-size-xs)]"
              aria-label={`Chon bien the cau tra loi, hien tai ${label}`}
              data-testid="message-variant-trigger"
            >
              {label}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="p-[var(--space-2)]"
            data-testid="message-variant-list"
          >
            <ul className="flex flex-col gap-1">
              {variants.map((variant, index) => {
                const isActive = variant.id === activeVariant?.id
                return (
                  <li key={variant.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectVariant(variant.turnId ?? message.turnId ?? '', variant.variantIndex ?? index)
                      }}
                      aria-label={`Bien the ${index + 1}`}
                      aria-current={isActive ? 'true' : undefined}
                      data-testid={`message-variant-${index}`}
                      className={
                        'w-full rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] ' +
                        'text-left text-[length:var(--font-size-sm)] text-[var(--text-primary)] ' +
                        'hover:bg-[var(--surface-sunken)] focus-visible:outline-none ' +
                        'focus-visible:ring-[var(--focus-ring)]'
                      }
                    >
                      <span className="font-medium">Bien the {index + 1}</span>
                      {isActive ? (
                        <span className="ml-1 text-[var(--text-tertiary)]">(dang dung)</span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  )
}
