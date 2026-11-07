/**
 * Skeleton khi dang tai lich su hoi thoai (T-M1-19).
 *
 * Truoc day khi user chon 1 conversation, panel hien **empty state**
 * (`PromptGallery`) trong luc `GET /api/conversations/:id/messages` con
 * dang chay → user thay "Chào bạn!" roi loang nhoang cau hoi → cham
 * (flash) khong mong doi.
 *
 * Bay gio hien skeleton de user biet "dang tai".
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.4
 */

export interface LoadingStateProps {
  /** So dong skeleton (mac dinh 3). */
  rows?: number
}

/**
 * Skeleton thread.
 */
export function LoadingState({ rows = 3 }: LoadingStateProps) {
  return (
    <div
      className="flex flex-col gap-3 p-[var(--space-3)]"
      data-testid="loading-state"
      role="status"
      aria-live="polite"
      aria-label="Dang tai cuoc tro chuyen"
    >
      <span className="sr-only">Đang tải cuộc trò chuyện...</span>
      {Array.from({ length: rows }, (_unused, index) => (
        <div
          key={index}
          className={[
            'animate-pulse rounded-[var(--radius-lg)] bg-[var(--surface-sunken)]',
            index % 2 === 0
              ? 'h-16 w-[85%] self-start'
              : 'h-12 w-[70%] self-end',
          ].join(' ')}
          data-testid="loading-state-row"
        />
      ))}
    </div>
  )
}
