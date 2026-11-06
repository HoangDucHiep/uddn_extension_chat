import { domainOf } from './CitationPopover'
import type { ChatCitation } from '../../store/chatStore'

/**
 * CitationList — dong tom tat nguon trich dan ben duoi bubble assistant
 * (FR-CONTEXT-10 — T-M1-08).
 *
 * Song song voi chip inline: chip cho "claim nao trich nguon nao", list cho
 * "co nhung nguon nao" (DP-6 — trust by transparency).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.9
 */
export interface CitationListProps {
  /** Danh sach nguon trich dan cua message. */
  citations: readonly ChatCitation[]
}

/**
 * Component danh sach nguon trich dan.
 *
 * @param props - Props cua danh sach.
 * @returns Element React (null neu khong co nguon).
 */
export function CitationList({ citations }: CitationListProps) {
  if (citations.length === 0) return null

  return (
    <ul
      className="mt-2 flex flex-wrap items-center gap-x-[var(--space-3)] gap-y-[var(--space-1)] border-t border-[var(--border-subtle)] pt-[var(--space-2)] text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
      data-testid="citation-list"
      aria-label="Nguồn trích dẫn"
    >
      {citations.map((citation) => {
        const domain = domainOf(citation.url)
        return (
          <li key={citation.index} className="flex items-center gap-[var(--space-1)]">
            <span
              className="inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-[var(--radius-sm)] border border-[var(--citation-border)] bg-[var(--citation-bg)] px-[3px] text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-[var(--citation-link)]"
              data-testid={`citation-index-${citation.index}`}
            >
              {citation.index}
            </span>
            <span
              className="max-w-[180px] truncate"
              data-testid={`citation-source-${citation.index}`}
              title={citation.title}
            >
              {domain.length > 0 ? domain : citation.title}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
