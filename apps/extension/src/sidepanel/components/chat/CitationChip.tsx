import { CitationPopover } from './CitationPopover'
import type { ChatCitation } from '../../store/chatStore'

/**
 * CitationChip — chip so `[N]` hien thi inline trong cau tra loi
 * (FR-CONTEXT-10 — T-M1-08).
 *
 * - **Co** metadata (da nhan SSE event `citation`) → chip co popover xem
 *   doan nguon.
 * - **Chua** co metadata (dang stream, hoac LLM sinh marker khong hop le)
 *   → chi render chip so, khong popover (tranh "chip chet").
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.9
 */
export interface CitationChipProps {
  /** Chi so nguon (1-based) — giong voi marker `[N]` trong markdown. */
  index: number
  /** Metadata nguon — `undefined` neu chua nhan duoc SSE event. */
  citation: ChatCitation | undefined
}

/**
 * Component chip trich dan.
 *
 * @param props - Props cua chip.
 * @returns Element React.
 */
export function CitationChip({ index, citation }: CitationChipProps) {
  if (citation === undefined) {
    return (
      <span className="citation-chip" data-testid={`citation-chip-${index}`}>
        {`[${index}]`}
      </span>
    )
  }

  return <CitationPopover index={index} citation={citation} />
}
