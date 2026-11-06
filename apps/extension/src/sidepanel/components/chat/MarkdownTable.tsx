import type { ReactNode } from 'react'

/**
 * Wrapper cho bang Markdown (FR-CHAT-04 — T-M1-07).
 *
 * Bang GFM co the rong hon panel (320 px) → boc trong `<div class="overflow-x-auto">`
 * de **scroll ngang** thay vi lam vo layout.
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.4
 */
export interface MarkdownTableProps {
  children: ReactNode
}

export function MarkdownTable({ children }: MarkdownTableProps) {
  return (
    <div
      className="my-[var(--space-2)] overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)]"
      data-testid="markdown-table-wrapper"
    >
      {children}
    </div>
  )
}
