import { useCallback, useEffect, useRef, useState } from 'react'
import { probeConnection, type ConnectionStatus } from '@/lib/connectionStatus'

/**
 * Hook `useConnectionStatus` — theo doi trang thai ket noi toi BFF.
 *
 * - Probe ngay khi mount, lap lai theo backoff 5s → 15s → 30s.
 * - Nghe `navigator.onLine` → phat hien offline **ngay lap tuc**.
 * - Tra `{ status, lastCheckedAt, retry }`.
 *
 * NFR-REL-04 — T-M1-19.
 * Docs: docs/SYSTEM_DESIGN.md §7.15
 */
export function useConnectionStatus(): {
  status: ConnectionStatus
  lastCheckedAt: number | undefined
  retry: () => void
} {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [lastCheckedAt, setLastCheckedAt] = useState<number | undefined>(undefined)
  const attemptRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mountedRef = useRef(true)

  const runProbe = useCallback(async (): Promise<void> => {
    const result = await probeConnection()
    if (!mountedRef.current) return

    setStatus(result.status)
    setLastCheckedAt(result.checkedAt)

    if (result.status === 'offline') {
      attemptRef.current += 1
      timerRef.current = setTimeout(() => {
        void runProbe()
      }, backoffDelay(attemptRef.current))
    } else {
      attemptRef.current = 0
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void runProbe()

    const handleOnline = (): void => {
      if (!mountedRef.current) return
      attemptRef.current = 0
      void runProbe()
    }
    const handleOffline = (): void => {
      if (!mountedRef.current) return
      setStatus('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      mountedRef.current = false
      if (timerRef.current !== undefined) clearTimeout(timerRef.current)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [runProbe])

  const retry = useCallback(() => {
    attemptRef.current = 0
    if (timerRef.current !== undefined) clearTimeout(timerRef.current)
    void runProbe()
  }, [runProbe])

  return { status, lastCheckedAt, retry }
}

/**
 * Do dai backoff cho lan probe tiep theo.
 *
 * @param attempt - So lan probe that bai da xay ra (>= 1).
 */
function backoffDelay(attempt: number): number {
  const sequence = [5_000, 15_000, 30_000] as const
  const index = Math.min(Math.max(attempt, 1) - 1, sequence.length - 1)
  return sequence[index] ?? 30_000
}
