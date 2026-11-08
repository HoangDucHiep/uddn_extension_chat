import { AlertTriangle, CheckCircle2, Loader2, WifiOff } from 'lucide-react'
import type { ConnectionStatus } from '@/lib/connectionStatus'
import { useI18n } from '@/sidepanel/hooks/useI18n'

/**
 * Badge trang thai ket noi (NFR-REL-04 — T-M1-19).
 *
 * Hien thi trong header panel canh provider chip. **Khong** chi dua vao
 * mau sac — luon co icon + chu (a11y).
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.4
 */

export interface ConnectionBadgeProps {
  status: ConnectionStatus
}

/** Key cua nhan cho tung trang thai. */
const STATUS_LABEL_KEY = {
  connecting: 'state.connection.connecting',
  connected: 'state.connection.connected',
  offline: 'state.connection.offline',
  degraded: 'state.connection.degraded',
} as const satisfies Record<ConnectionStatus, 'state.connection.connecting' | 'state.connection.connected' | 'state.connection.offline' | 'state.connection.degraded'>

/** Class mau cua tung trang thai (dung design token — khong hardcode mau). */
const STATUS_CLASS_NAME: Record<ConnectionStatus, string> = {
  connecting: 'text-[var(--text-tertiary)]',
  connected: 'text-[var(--color-accent-hover)]',
  offline: 'text-[var(--danger)]',
  degraded: 'text-[var(--warning)]',
}

/**
 * Chip trang thai ket noi.
 */
export function ConnectionBadge({ status }: ConnectionBadgeProps) {
  const { t } = useI18n()
  const label = t(STATUS_LABEL_KEY[status])
  const Icon = status === 'connecting' ? Loader2 : status === 'connected' ? CheckCircle2 : status === 'offline' ? WifiOff : AlertTriangle

  return (
    <span
      className={[
        'inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-full)] px-2 py-0.5',
        'text-[length:var(--font-size-xs)]',
        STATUS_CLASS_NAME[status],
      ].join(' ')}
      data-testid="connection-badge"
      data-status={status}
      title={label}
    >
      <Icon
        className={['h-3 w-3', status === 'connecting' ? 'animate-spin' : ''].join(' ')}
        aria-hidden="true"
      />
      {label}
    </span>
  )
}
