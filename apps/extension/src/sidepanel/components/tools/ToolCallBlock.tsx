import { Check, ChevronDown, ChevronRight, Wrench, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import { approveToolCall, denyToolCall } from '@/lib/toolClient'
import type { ChatToolCall } from '../../store/chatStore'

/**
 * ToolCallBlock — block collapsible hien thi 1 tool call (FR-TOOLS-02 — T-M2-09).
 *
 * - Header: icon `Wrench` + ten tool + badge trang thai.
 * - Mo rong: tham so (JSON pretty) + ket qua.
 * - Tool can duyet → badge "Can ban duyet" + nut "Duyet" / "Tu choi"
 *   (FR-TOOLS-04).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.26.9
 */
export interface ToolCallBlockProps {
  /** Tool call can hien thi. */
  toolCall: ChatToolCall
  /** Handler cap nhat tool call (duyet / tu choi). */
  onUpdate?: (toolCallId: string, patch: Partial<ChatToolCall>) => void
}

/**
 * Component block tool call.
 *
 * @param props - Props cua block.
 * @returns Element React.
 */
export function ToolCallBlock({ toolCall, onUpdate }: ToolCallBlockProps) {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(false)

  const status = resolveStatus(toolCall)
  const needsApproval =
    toolCall.approvalRequired === true &&
    toolCall.approvedByUser !== true &&
    toolCall.deniedByUser !== true

  const handleApproval = async (approved: boolean): Promise<void> => {
    if (isBusy) return
    setIsBusy(true)
    try {
      if (approved) {
        await approveToolCall(toolCall.id)
        onUpdate?.(toolCall.id, { approvedByUser: true, deniedByUser: false, status: 'ok' })
        toast.success(t('toast.toolApproved', { name: toolCall.name }))
      } else {
        await denyToolCall(toolCall.id)
        onUpdate?.(toolCall.id, { approvedByUser: false, deniedByUser: true, status: 'denied' })
        toast.info(t('toast.toolDenied', { name: toolCall.name }))
      }
    } catch {
      toast.error(t('toast.toolApprovalFailed'))
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div
      className="mt-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] text-[length:var(--font-size-sm)]"
      data-testid="tool-call-block"
      data-tool-status={status}
      data-tool-name={toolCall.name}
    >
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen)
        }}
        className="flex w-full items-center gap-2 px-[var(--space-2)] py-[var(--space-2)] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
        aria-expanded={isOpen}
        aria-label={isOpen ? t('tool.call.collapse') : t('tool.call.expand')}
        data-testid="tool-call-toggle"
      >
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          {t('tool.call.title', { name: toolCall.name })}
        </span>
        <StatusBadge status={status} />
      </button>

      {isOpen ? (
        <div className="border-t border-[var(--border-default)] px-[var(--space-2)] py-[var(--space-2)]">
          <div className="mb-2">
            <p className="mb-1 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
              {t('tool.call.args')}
            </p>
            <pre
              className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] p-[var(--space-2)] font-mono text-[length:var(--font-size-xs)]"
              data-testid="tool-call-args"
            >
              {formatJson(toolCall.args)}
            </pre>
          </div>

          {toolCall.output !== undefined ? (
            <div>
              <p className="mb-1 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
                {t('tool.call.output')}
              </p>
              <pre
                className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] p-[var(--space-2)] font-mono text-[length:var(--font-size-xs)]"
                data-testid="tool-call-output"
              >
                {toolCall.output}
              </pre>
            </div>
          ) : null}

          {toolCall.durationMs !== undefined ? (
            <p className="mt-2 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
              {t('tool.call.duration', { duration: String(toolCall.durationMs) })}
            </p>
          ) : null}

          {needsApproval ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className="rounded-[var(--radius-sm)] bg-[var(--warning-subtle)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--font-size-xs)] text-[var(--warning)]"
                data-testid="tool-call-approval-badge"
              >
                {t('tool.call.approvalRequired')}
              </span>
              <Button
                size="sm"
                onClick={() => {
                  void handleApproval(true)
                }}
                disabled={isBusy}
                aria-label={t('tool.call.approve')}
                data-testid="tool-call-approve"
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {t('tool.call.approve')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void handleApproval(false)
                }}
                disabled={isBusy}
                aria-label={t('tool.call.deny')}
                data-testid="tool-call-deny"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                {t('tool.call.deny')}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Badge trang thai cua tool call.
 *
 * @param props - Props cua badge.
 * @returns Element React.
 */
function StatusBadge({ status }: { status: ChatToolCall['status'] }) {
  const { t } = useI18n()

  const label =
    status === 'ok'
      ? t('tool.call.ok')
      : status === 'error'
        ? t('tool.call.error')
        : status === 'denied'
          ? t('tool.call.denied')
          : status === 'running'
            ? t('tool.call.running')
            : t('tool.call.pending')

  const tone =
    status === 'ok'
      ? 'bg-[var(--success-subtle)] text-[var(--success)]'
      : status === 'error'
        ? 'bg-[var(--danger-subtle)] text-[var(--danger)]'
        : status === 'denied'
          ? 'bg-[var(--surface-sunken)] text-[var(--text-secondary)]'
          : 'bg-[var(--warning-subtle)] text-[var(--warning)]'

  return (
    <span
      className={`shrink-0 rounded-[var(--radius-sm)] px-[var(--space-1)] py-[var(--space-1)] text-[length:var(--font-size-xs)] ${tone}`}
      data-testid="tool-call-status"
    >
      {label}
    </span>
  )
}

/**
 * Suy ra trang thai hien thi cua tool call.
 *
 * @param toolCall - Tool call trong state.
 * @returns Trang thai chuan hoa.
 */
function resolveStatus(toolCall: ChatToolCall): ChatToolCall['status'] {
  if (toolCall.status !== undefined) return toolCall.status
  if (toolCall.deniedByUser === true) return 'denied'
  if (toolCall.output !== undefined) return toolCall.ok === false ? 'error' : 'ok'
  if (toolCall.approvalRequired === true) return 'pending'
  return 'running'
}

/**
 * Format gia tri JSON de hien thi trong `<pre>`.
 *
 * @param value - Gia tri bat ky (args cua tool).
 * @returns Chuoi JSON pretty (fallback sang `String`).
 */
function formatJson(value: unknown): string {
  if (value === undefined) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
