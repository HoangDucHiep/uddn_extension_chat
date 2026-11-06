import { ExternalLink } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ChatCitation } from '../../store/chatStore'

/**
 * CitationPopover — xem doan nguon cua 1 trich dan (FR-CONTEXT-10 — T-M1-08).
 *
 * Hien thi: tieu de · domain · doan trich · nut "Mo trang goc".
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.9
 */
export interface CitationPopoverProps {
  /** Chi so nguon (1-based) — giong voi marker `[N]`. */
  index: number
  /** Metadata nguon (tu SSE event `citation`). */
  citation: ChatCitation
}

/**
 * Lay domain cua URL (bo `www.`) — de nguon doc nhanh hon.
 *
 * @param url - URL cua nguon.
 * @returns Domain hien thi (rong neu URL khong hop le).
 */
export function domainOf(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * Noi dung popover — tieu de · domain · doan trich · nut mo trang goc.
 *
 * @param props - Props cua noi dung popover.
 * @returns Element React.
 */
export function CitationPopoverContent({ citation }: { citation: ChatCitation }) {
  const domain = domainOf(citation.url)

  const openSource = (): void => {
    if (citation.url.length === 0) return
    try {
      void chrome.tabs.create({ url: citation.url })
    } catch {
      // Khong mo duoc tab → bo qua.
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <div>
        <p
          className="text-[length:var(--font-size-sm)] font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
          data-testid="citation-title"
        >
          {citation.title}
        </p>
        {domain.length > 0 ? (
          <p
            className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
            data-testid="citation-domain"
          >
            {domain}
          </p>
        ) : null}
      </div>

      {citation.snippet.length > 0 ? (
        <p
          className="max-h-[160px] overflow-y-auto whitespace-pre-wrap text-[length:var(--font-size-sm)] text-[var(--text-secondary)]"
          data-testid="citation-snippet"
        >
          {citation.snippet}
        </p>
      ) : null}

      <button
        type="button"
        onClick={openSource}
        disabled={citation.url.length === 0}
        className="inline-flex w-fit items-center gap-[var(--space-1)] rounded-[var(--radius-sm)] border border-[var(--border-default)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--font-size-sm)] text-[var(--text-primary)] transition-colors duration-fast ease-standard hover:bg-[var(--surface-sunken)] disabled:pointer-events-none disabled:opacity-50"
        data-testid="citation-open-source"
        aria-label="Mở trang gốc"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Mở trang gốc</span>
      </button>
    </div>
  )
}

/**
 * Component popover trich dan — trigger la chip so `[N]`.
 *
 * @param props - Props cua popover.
 * @returns Element React.
 */
export function CitationPopover({ index, citation }: CitationPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="citation-chip"
          data-testid={`citation-chip-${index}`}
          aria-label={`Xem nguồn ${index}: ${citation.title}`}
        >
          {`[${index}]`}
        </button>
      </PopoverTrigger>
      <PopoverContent data-testid={`citation-popover-${index}`}>
        <CitationPopoverContent citation={citation} />
      </PopoverContent>
    </Popover>
  )
}
