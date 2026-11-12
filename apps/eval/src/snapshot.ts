/**
 * Tien ich chụp snapshot trang cho eval dataset (T-M2-12).
 *
 * Muc tieu:
 *  1. Bien **HTML thu** thanh **text thuan** de gui vao context cua LLM
 *     (dung format giong `context.items[].text` cua extension).
 *  2. Tinh hash noi dung (`sha256`) → `page.content_hash` trong dataset.
 *  3. Luu snapshot **tinh** vao repo → harness chay lai duoc, khong doc
 *     trang live (FC-2 trong `EVAL_PLAN.md` §9).
 *
 * Vi sao **khong** dung DOM / jsdom?
 *  - `apps/eval` chay tren Node thuan, khong nen keo `jsdom` vao dep.
 *  - Bo trich xuat phai **deterministic**: cung HTML → cung text → cung hash.
 *
 * Docs: docs/EVAL_PLAN.md §3.4
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { LIMITS } from '@sidekick/shared/constants'

/** Thu muc goc cua app eval. */
const APP_ROOT = resolve(import.meta.dirname, '..')

/** Thu muc chua snapshot. */
export const SNAPSHOT_DIR = resolve(APP_ROOT, 'dataset', 'snapshots')

/**
 * Cac tag bi loai hoan toan (khong phai noi dung doc).
 *
 * `nav` / `footer` / `aside` / `header` la "vung nhieu" cua trang → loai
 * de snapshot khong chua menu/chan trang (giong extractor cua extension).
 */
const DROPPED_TAGS = [
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'svg',
  'canvas',
  'form',
  'nav',
  'footer',
  'aside',
  'header',
  'button',
  'select',
  'textarea',
] as const

/**
 * Cac tag co phan noi dung → tach thanh dong rieng khi tach text.
 *
 * `p` · `li` · `h1..h6` · `pre` · `blockquote` · `td` · `th` · `dd` · `dt` ·
 * `figcaption` · `tr` · `section` · `div` · `article` · `main`.
 */
const BLOCK_TAGS = [
  'p',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'pre',
  'blockquote',
  'td',
  'th',
  'dd',
  'dt',
  'figcaption',
  'tr',
  'section',
  'div',
  'article',
  'main',
  'br',
] as const

/** Bang HTML entity thuong gap. */
const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  ldquo: '\u201C',
  rdquo: '\u201D',
  lsquo: '\u2018',
  rsquo: '\u2019',
  middot: '·',
  bull: '•',
  deg: '°',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  pound: '£',
  yen: '¥',
}

/**
 * Giai ma HTML entity co ban (`&amp;` · `&#39;` · `&#x27;` · named).
 *
 * @param text - Text can giai ma.
 */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match
  })
}

/**
 * Chuan hoa whitespace: ghep space, bo dong trong, gom 3 dong trong xuong 2.
 *
 * @param text - Text can chuan hoa.
 */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Cat text tai gioi han do dai, cat tai ranh gioi tu.
 *
 * @param text - Text can cat.
 * @param maxChars - Do dai toi da.
 */
export function truncateText(text: string, maxChars: number = LIMITS.MAX_PAGE_TEXT_CHARS): string {
  if (text.length <= maxChars) return text

  const slice = text.slice(0, maxChars)
  const lastSpace = slice.lastIndexOf(' ')
  const safe = lastSpace > maxChars * 0.8 ? slice.slice(0, lastSpace) : slice
  return safe.trimEnd()
}

/**
 * Loai bỏ mọi phần tử HTML khớp `predicate`, gồm cả thẻ đóng tương ứng.
 *
 * Dùng **đếm độ sâu** thay vì regex non-greedy → xử lý đúng các phần tử
 * lồng nhau (regex sẽ dừng ở thẻ đóng đầu tiên → sót nội dung).
 *
 * @param html - HTML cần xử lý.
 * @param predicate - Điều kiện nhận diện thẻ mở (chuỗi thẻ + thuộc tính).
 * @returns HTML đã loại bỏ phần tử khớp.
 */
/**
 * Cac custom element `devsite-*` cua Chrome for Developers chi chua
 * **nhieu / dieu huong** → loai khi trich xuat noi dung tai lieu.
 *
 * Luu y: **khong** loai `devsite-content` (chua noi dung bai viet).
 */
const NOISY_DEVSITE_ELEMENTS = new Set([
  'devsite-header',
  'devsite-footer-linkboxes',
  'devsite-footer-promos',
  'devsite-footer-utility',
  'devsite-recommendations-sidebar',
  'devsite-feature-tooltip',
  'devsite-llm-tools',
  'devsite-toc',
  'devsite-notification',
  'devsite-snackbar',
  'devsite-cookie-notification-bar',
  'devsite-search',
  'devsite-actions',
  'devsite-panel',
  'devsite-selector',
  'devsite-thumb-rating',
  'devsite-switch-to-english-button',
  'devsite-view-release-notes',
  'devsite-progress',
  'devsite-badger',
  'devsite-bookmark',
  'devsite-book-nav',
])

export function stripElements(
  html: string,
  predicate: (openTag: string, tagName: string) => boolean,
): string {
  let result = html
  let cursor = 0

  for (;;) {
    const opener = /<([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g
    opener.lastIndex = cursor

    let found: RegExpExecArray | null = null
    let tagName = ''
    let openTag = ''

    for (;;) {
      const candidate = opener.exec(result)
      if (candidate === null) break
      const name = candidate[1] ?? ''
      const attrs = candidate[2] ?? ''
      if (!predicate(`<${name}${attrs}>`, name.toLowerCase())) continue
      found = candidate
      tagName = name.toLowerCase()
      openTag = candidate[0]
      break
    }

    if (found === null) break

    const start = found.index
    const afterOpen = start + openTag.length

    // Quét tới theo thẻ đóng cùng tên (đếm độ sâu).
    const scanner = new RegExp(`<(/?)${tagName}\\b((?:"[^"]*"|'[^']*'|[^>])*)>`, 'gi')
    scanner.lastIndex = afterOpen
    let depth = 1
    let end = -1

    for (;;) {
      const step = scanner.exec(result)
      if (step === null) break
      if (step[1] === '/') {
        depth -= 1
        if (depth === 0) {
          end = step.index + step[0].length
          break
        }
      } else if (!step[0].endsWith('/>')) {
        depth += 1
      }
    }

    if (end === -1) {
      // Không tìm thấy thẻ đóng (custom element không có closing tag) →
      // chỉ bỏ thẻ mở, **không** cắt cả phần còn lại của tài liệu.
      result = result.slice(0, start) + result.slice(afterOpen)
      cursor = start
      continue
    }

    result = result.slice(0, start) + result.slice(end)
    cursor = start
  }

  return result
}

/**
 * Tach phan noi dung chinh cua HTML.
 *
 * Uu tien `article` → `main` → `body` → toan bo HTML (fallback).
 * Sau do loai tag nhieu, chuyen block thanh dong, tach tag con lai.
 *
 * @param html - HTML thu.
 */
export function htmlToText(html: string): string {
  // Loai comment + phan `<head>` (title/meta/script/style).
  let working = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, ' ')
    .replace(/<html\b[^>]*>/gi, ' ')
    .replace(/<body\b[^>]*>/gi, ' ')

  for (const tag of DROPPED_TAGS) {
    working = working.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi'), ' ')
    // Tag khong co closing (vd `<br>`) → chi bo opening tag.
    working = working.replace(new RegExp(`<${tag}\\b[^>]*/?>`, 'gi'), ' ')
  }

  // Custom element `devsite-*` + khoi `data-nosnippet` cua Chrome for
  // Developers → chi chua nội dung quảng cáo / bookmark, không phai tai liệu.
  working = stripElements(
    working,
    (openTag, tagName) =>
      NOISY_DEVSITE_ELEMENTS.has(tagName) || /\bdata-nosnippet\b/i.test(openTag),
  )

  const bodyMatch = working.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)
  const body = bodyMatch?.[1] ?? working

  const articleMatch = body.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)
  const mainMatch = body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)
  let content = articleMatch?.[1] ?? mainMatch?.[1] ?? body

  for (const tag of BLOCK_TAGS) {
    content = content.replace(new RegExp(`</?${tag}\\b[^>]*>`, 'gi'), '\n')
  }

  // Strip tag con lai (inline markup).
  const stripped = content.replace(/<[^>]+>/g, ' ')

  return truncateText(normalizeWhitespace(decodeHtmlEntities(stripped)))
}

/**
 * Tinh hash sha256 noi dung snapshot.
 *
 * @param content - Noi dung snapshot.
 * @returns Chuoi dang `sha256:<hex>`.
 */
export function sha256Content(content: string): string {
  const hash = createHash('sha256').update(content, 'utf8').digest('hex')
  return `sha256:${hash}`
}

/**
 * Doc file snapshot.
 *
 * @param relativePath - Duong dan tuong doi repo root (VD `apps/eval/dataset/snapshots/x.txt`).
 */
export async function readSnapshot(relativePath: string): Promise<string> {
  return readFile(resolve(APP_ROOT, '..', '..', relativePath), 'utf8')
}

/**
 * Ghi file snapshot (tao thu muc neu chua co).
 *
 * @param relativePath - Duong dan tuong doi repo root.
 * @param content - Noi dung can ghi.
 */
export async function writeSnapshot(relativePath: string, content: string): Promise<void> {
  const absolute = resolve(APP_ROOT, '..', '..', relativePath)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, content, 'utf8')
}

/**
 * Tao duong dan snapshot tuong doi repo root tu slug.
 *
 * @param slug - Slug ngan, an toan cho ten file (VD `wikipedia-vi-python`).
 */
export function snapshotPathFor(slug: string): string {
  return `apps/eval/dataset/snapshots/${slug}.txt`
}

/**
 * Doc snapshot + tinh lai hash → kiem tra snapshot con khop voi dataset.
 *
 * @param relativePath - Duong dan tuong doi repo root.
 */
export async function loadSnapshotWithHash(relativePath: string): Promise<{
  content: string
  contentHash: string
}> {
  const content = await readSnapshot(relativePath)
  return { content, contentHash: sha256Content(content) }
}
