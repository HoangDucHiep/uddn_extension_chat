/**
 * Remark plugin — bien marker trich dan `[N]` thanh chip inline (FR-CONTEXT-10 — T-M1-08).
 *
 * Plugin **thuan** (khong phu thuoc React): tach node `text` trong mdast
 * thanh nhieu node con, gan cho node marker:
 *   - `data.hName = 'span'`
 *   - `data.hProperties = { dataCitationIndex: N }`
 *
 * Sau do `rehype-sanitize` (voi `markdownSchema`) cho phep `dataCitationIndex`
 * tren `span`, va `MessageContent` override `span` de render `<CitationChip>`.
 *
 * **Khong** cham vao code block / inline code (node `code` / `inlineCode`) →
 * trong code, `[1]` van la text thuần.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.9
 */

import { CITATION_MARKER_PATTERN } from '@sidekick/shared'

/**
 * Regex bat marker `[N]` — dung chung pattern voi server
 * (`packages/shared/src/citation.ts`) → hai ben khong the lech.
 */
const MARKER_PATTERN = CITATION_MARKER_PATTERN

/**
 * Node mdast rut gon — chi can cac truong plugin dung.
 *
 * Khong import truc tiep type `mdast` de tranh them dependency runtime.
 */
interface MdastNode {
  type: string
  value?: string
  children?: MdastNode[]
  data?: {
    hName?: string
    hProperties?: Record<string, unknown>
    [key: string]: unknown
  }
}

/**
 * Tao node text thuần.
 *
 * @param value - Noi dung text.
 * @returns Node mdast kieu `text`.
 */
function createText(value: string): MdastNode {
  return { type: 'text', value }
}

/**
 * Tao node mang marker trich dan.
 *
 * @param index - So nguon (1-based).
 * @returns Node mdast kieu `html`-free (data hoc).
 */
function createCitationNode(index: number): MdastNode {
  return {
    type: 'text',
    value: `[${index}]`,
    data: {
      hName: 'span',
      hProperties: { dataCitationIndex: index },
    },
  }
}

/**
 * Tach 1 node `text` thanh mang node con neu co marker.
 *
 * @param node - Node text can tach.
 * @returns Mang node con (1 phan tu neu khong co marker).
 */
export function splitTextByCitationMarkers(node: MdastNode): MdastNode[] {
  const value = node.value ?? ''
  if (value.length === 0) return [node]

  // `matchAll` khong mutate `lastIndex` cua regex goc → an toan ham thuan.
  const matches = [...value.matchAll(MARKER_PATTERN)]
  if (matches.length === 0) return [node]

  const result: MdastNode[] = []
  let cursor = 0

  for (const match of matches) {
    const start = match.index
    const matched = match[0]
    if (start === undefined || matched === undefined) continue

    if (start > cursor) {
      result.push(createText(value.slice(cursor, start)))
    }

    const index = Number.parseInt(match[1] ?? '', 10)
    if (Number.isInteger(index) && index > 0) {
      result.push(createCitationNode(index))
    }

    cursor = start + matched.length
  }

  if (cursor < value.length) {
    result.push(createText(value.slice(cursor)))
  }

  return result
}

/**
 * De quy thay the cac node `text` chua marker.
 *
 * @param node - Node cha.
 * @returns Node da thay the noi dung.
 */
export function transformCitationMarkers(node: MdastNode): MdastNode {
  // Node `code` / `inlineCode` chua text nguyen → KHONG tach.
  if (node.type === 'code' || node.type === 'inlineCode') return node
  if (node.children === undefined) return node

  const nextChildren: MdastNode[] = []

  for (const child of node.children) {
    if (child.type === 'text') {
      nextChildren.push(...splitTextByCitationMarkers(child))
      continue
    }

    nextChildren.push(transformCitationMarkers(child))
  }

  node.children = nextChildren
  return node
}

/**
 * Remark plugin — thay marker `[N]` bang node chip.
 *
 * @returns Transformer cho mdast tree.
 */
export function citationPlugin() {
  return transformCitationMarkers
}

export default citationPlugin
