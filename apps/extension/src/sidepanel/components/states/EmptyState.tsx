import type { PageProfile, PromptSuggestion } from '@sidekick/shared'
import { PromptGallery } from '../chat/PromptGallery'

/**
 * Empty state cua panel (T-M1-19).
 *
 * Empty state **da** co san tu T-M1-11 (`PromptGallery`) → file nay chi
 * la wrapper de 4 trang thai cua panel (loading · empty · error · offline)
 * co **mot diem vao chung**.
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.4
 */

export interface EmptyStateProps {
  /** Loai trang hien tai → chon bo goi y. */
  profile: PageProfile
  /** Tieu de trang hien tai. */
  pageTitle: string
  /** Bo goi y hien thi. */
  suggestions: readonly PromptSuggestion[]
  /** Chon 1 goi y → gui prompt. */
  onSelect: (prompt: string) => void
  /** Bam nut tom tat → tom tat trang 1-click. */
  onSummarize: () => void
  /** Bam nut lam moi → xoay vong bo goi y. */
  onRefresh: () => void
  /** Dang gui → vo hieu hoa nut. */
  isSending?: boolean
  /** Trang hien tai doc duoc hay khong. */
  canAttachPage: boolean
}

/**
 * Wrapper cua empty state.
 */
export function EmptyState({
  profile,
  pageTitle,
  suggestions,
  onSelect,
  onSummarize,
  onRefresh,
  isSending = false,
  canAttachPage,
}: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col" data-testid="empty-state">
      <PromptGallery
        profile={profile}
        pageTitle={pageTitle}
        suggestions={suggestions}
        onSelect={onSelect}
        onSummarize={onSummarize}
        onRefresh={onRefresh}
        isSending={isSending}
        canAttachPage={canAttachPage}
      />
    </div>
  )
}
