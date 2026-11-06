import {
  createContext,
  useContext,
  useDeferredValue,
  type ComponentPropsWithoutRef,
} from 'react'
import ReactMarkdown, { type Components, type Options } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { CodeBlock, CodeBlockContext } from './CodeBlock'
import { CitationChip } from './CitationChip'
import { citationPlugin } from './citationPlugin'
import { MarkdownTable } from './MarkdownTable'
import {
  extractCodeText,
  languageFromNode,
  LANGUAGE_ALIASES,
  markdownSchema,
} from './markdownSchema'
import type { ChatCitation } from '../../store/chatStore'

/**
 * Noi dung Markdown cua message assistant (FR-CHAT-02/03/04 — T-M1-07).
 *
 * Pipeline: `remark-parse` → `remark-gfm` → `remark-rehype` →
 * `rehype-highlight` → `rehype-sanitize` → render React.
 *
 * Chien luoc hieu nang (NFR-PERF-02):
 *  - Khi `isStreaming === true` → **khong** bat `rehype-highlight` (re-parse
 *    toan cay moi token → O(n^2), code block nhay unhighlighted).
 *  - Khi stream xong → highlight 1 lan duy nhat.
 *  - `useDeferredValue(content)` → parse markdown chay sau frame hien tai,
 *    giu input + nhan token luon responsive.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.8
 */
export interface MessageContentProps {
  /** Noi dung markdown tho cua message. */
  content: string
  /** Message dang duoc stream (thi defer highlight). */
  isStreaming?: boolean
  /**
   * Danh sach nguon trich dan cua message (FR-CONTEXT-10 — T-M1-08).
   *
   * Dung de chip inline `[N]` tra ve metadata (tieu de + doan trich).
   */
  citations?: readonly ChatCitation[]
}

/**
 * Plugin list cho nhanh khong highlight (streaming).
 *
 * Module-level hang so de `react-markdown` khong tao processor moi o moi
 * render.
 *
 * LUU Y: `rehype-sanitize` nhan **schema truc tiep** (khong phai `{ schema }`).
 */
const REHYPE_PLUGINS_STREAMING: Options['rehypePlugins'] = [
  [rehypeSanitize, markdownSchema],
]

/** Plugin list khi stream xong — highlight truoc sanitize. */
const REHYPE_PLUGINS_DONE: Options['rehypePlugins'] = [
  [rehypeHighlight, { aliases: LANGUAGE_ALIASES }],
  [rehypeSanitize, markdownSchema],
]

/** Danh sach plugin `remark` (module-level hang). */
const REMARK_PLUGINS: Options['remarkPlugins'] = [remarkGfm, citationPlugin]

/** Props cua override `pre` (react-markdown truyen them `node` hast). */
type PreProps = ComponentPropsWithoutRef<'pre'> & { node?: unknown }

/** Props cua override `code`. */
type CodeProps = ComponentPropsWithoutRef<'code'> & { node?: unknown }

/** Props cua override `a`. */
type AnchorProps = ComponentPropsWithoutRef<'a'> & { node?: unknown }

/** Props cua override `table`. */
type TableProps = ComponentPropsWithoutRef<'table'> & { node?: unknown }

/** Props cua override `span`. */
type SpanProps = ComponentPropsWithoutRef<'span'> & {
  node?: { properties?: Readonly<Record<string, unknown>> } | undefined
}

/**
 * Context chua danh sach nguon trich dan cua message hien tai.
 *
 * Dung context (thay vi tao lai `components` map moi moi render) → giu
 * `react-markdown` khong re-parse lai cay React khi chi doi danh sach
 * trich dan (NFR-PERF-02).
 */
const CitationContext = createContext<readonly ChatCitation[]>([])

/**
 * Doc chi so nguon tu node hast cua override `span`.
 *
 * `rehype-sanitize` giu property `dataCitationIndex` (allowlist) →
 * `hast-util-to-jsx-runtime` doi thanh prop `data-citation-index` tren
 * React element, va `node.properties.dataCitationIndex` van giu nguyen
 * gia tri goc.
 *
 * @param node - Node hast cua `span`.
 * @returns Chi so nguon (1-based) hoac `undefined`.
 */
function citationIndexOf(node: SpanProps['node']): number | undefined {
  const raw = node?.properties?.['dataCitationIndex']
  if (typeof raw !== 'number') return undefined
  if (!Number.isInteger(raw) || raw <= 0) return undefined
  return raw
}

/**
 * Component override cho `span`.
 *
 * - Có `dataCitationIndex` → render `CitationChip` (chip trich dan).
 * - Khong có → pass-through (giữ `span.hljs-*` cua T-M1-07).
 *
 * @param props - Props cua `span`.
 * @returns Element React.
 */
function SpanOverride({ node, children, className, ...rest }: SpanProps) {
  const citations = useContext(CitationContext)
  const index = citationIndexOf(node)

  if (index === undefined) {
    return (
      <span {...rest} className={className}>
        {children}
      </span>
    )
  }

  const citation = citations.find((item) => item.index === index)

  return <CitationChip index={index} citation={citation} />
}

/**
 * Component override cho `pre` — boc trong `CodeBlock` (copy + nhan ngon ngu).
 *
 * @param props - Props cua `pre` (ke ca `node` hast).
 * @returns Element React.
 */
function PreOverride({ node, children }: PreProps) {
  const language = languageFromNode(node)
  const code = extractCodeText(node)

  return (
    <CodeBlockContext.Provider value>
      <CodeBlock code={code} language={language}>
        {children}
      </CodeBlock>
    </CodeBlockContext.Provider>
  )
}

/**
 * Component override cho `code`.
 *
 * - Inline code → chip nền sunken, font mono.
 * - Code trong `pre` → giu nguyên markup highlight cua `rehype-highlight`.
 *
 * @param props - Props cua `code`.
 * @returns Element React.
 */
function CodeOverride({ node: _node, className, children }: CodeProps) {
  const isInsideBlock = useContext(CodeBlockContext)

  if (isInsideBlock) {
    return <code className={className}>{children}</code>
  }

  return (
    <code
      className={[
        className ?? '',
        'rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] px-[var(--space-1)] py-[2px] font-mono text-[length:var(--font-size-sm)]',
      ]
        .filter((item) => item.length > 0)
        .join(' ')}
    >
      {children}
    </code>
  )
}

/**
 * Component override cho `a` — luon mo tab moi, chan `opener`.
 *
 * @param props - Props cua `a`.
 * @returns Element React.
 */
function AnchorOverride({ node: _node, children, href, ...rest }: AnchorProps) {
  return (
    <a {...rest} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

/**
 * Component override cho `table` — boc trong wrapper scroll ngang.
 *
 * @param props - Props cua `table`.
 * @returns Element React.
 */
function TableOverride({ node: _node, children }: TableProps) {
  return (
    <MarkdownTable>
      <table>{children}</table>
    </MarkdownTable>
  )
}

/**
 * Component map cho `react-markdown` (module-level hang de khong re-create).
 */
const MARKDOWN_COMPONENTS: Components = {
  pre: PreOverride,
  code: CodeOverride,
  a: AnchorOverride,
  table: TableOverride,
  span: SpanOverride,
}

export function MessageContent({
  content,
  isStreaming = false,
  citations = [],
}: MessageContentProps) {
  // Defer parse: giu input + stream token responsive (NFR-PERF-02).
  const deferredContent = useDeferredValue(content)

  return (
    <div className="markdown-body break-words" data-testid="message-content">
      <CitationContext.Provider value={citations}>
        <ReactMarkdown
          remarkPlugins={REMARK_PLUGINS}
          rehypePlugins={isStreaming ? REHYPE_PLUGINS_STREAMING : REHYPE_PLUGINS_DONE}
          skipHtml
          components={MARKDOWN_COMPONENTS}
        >
          {deferredContent}
        </ReactMarkdown>
      </CitationContext.Provider>
    </div>
  )
}
