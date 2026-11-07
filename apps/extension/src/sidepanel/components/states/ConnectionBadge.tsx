import { AlertTriangle, CheckCircle2, Loader2, WifiOff } from 'lucide-react'
import type { ConnectionStatus } from '@/lib/connectionStatus'

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

/** Nhan + icon cua tung trang thai. */
const STATUS_META: Record<
  ConnectionStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  connecting: {
    label: 'Dang ket noi',
    icon: Loader2,
    className: 'text-[var(--text-tertiary)]',
  },
  connected: {
    label: 'Da ket noi',
    icon: CheckCircle2,
    className: 'text-[var(--color-accent-hover)]',
  },
  offline: {
    label: 'Offline',
    icon: WifiOff,
    className: 'text-[var(--danger)]',
  },
  degraded: {
    label: 'May chu loi',
    icon: AlertTriangle,
    className: 'text-[var(--warning)]',
  },
}

/**
 * Chip trang thai ket noi.
 */
export function ConnectionBadge({ status }: ConnectionBadgeProps) {
  const meta = STATUS_META[status]
  const Icon = meta.icon

  return (
    <span
      className={[
        'inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-full)] px-2 py-0.5',
        'text-[length:var(--font-size-xs)]',
        meta.className,
      ].join(' ')}
      data-testid="connection-badge"
      data-status={status}
      title={meta.label}
    >
      <Icon
        className={['h-3 w-3', status === 'connecting' ? 'animate-spin' : ''].join(' ')}
        aria-hidden="true"
      />
      {meta.label}
    </span>
  )
}
