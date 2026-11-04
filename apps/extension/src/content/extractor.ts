/**
 * Extractor "Readability-lite" — trich noi dung chinh cua trang web.
 *
 * Ban rut gon cua Mozilla Readability: khong phai thu vien ngoai, khong dung
 * network, chay hoan toan trong content script.
 *
 * Nguyen tac:
 *  - KHONG mutate DOM that cua user → luon clone `Document` truoc khi lam viec.
 *  - KHONG dung `chrome.*` trong file nay → de test duoc trong jsdom.
 *  - Ket qua luon co fallback (body text) → khong bao gio tra ve rong khi trang co noi dung.
 *
 * Docs: docs/SYSTEM_DESIGN.md §3 (content/extractor.ts), FR-CONTEXT-01
 */

import { LIMITS } from '@sidekick/shared/constants'

/** Chien luoc trich xuat dung de sinh ra ket qua. */
export type ExtractionStrategy = 'article' | 'main' | 'body' | 'empty'

/** Ket qua trich xuat noi dung trang. */
export interface ExtractedPage {
  /** Tieu de trang (uu tien `og:title`). */
  title: string
  /** Tac gia / nguoi viet (neu tim thay). */
  byline: string
  /** URL cua trang. */
  url: string
  /** Noi dung chinh da chuan hoa whitespace. */
  text: string
  /** Trich dan ngan dung cho preview trong UI. */
  excerpt: string
  /** Chien luoc da dung de tim noi dung chinh. */
  strategy: ExtractionStrategy
  /** So tu trong `text`. */
  wordCount: number
}

/** Cac the khong bao gio chua noi dung doc duoc. */
const STRIPPED_TAGS = [
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

/** Selector cua cac phan tu "nhieu" — lo ra khoi noi dung chinh. */
const NEGATIVE_PATTERN =
  /(^|[-_\s])(nav|menu|sidebar|footer|header|comment|comments|ad|ads|advert|promo|banner|cookie|subscribe|newsletter|related|breadcrumb|pagination|pager|toolbar|share|social|widget|popup|modal|overlay)([-_\s]|$)/i

/** Selector cua cac phan tu "noi dung" — uu tien khi chon node. */
const POSITIVE_PATTERN =
  /(^|[-_\s])(article|body|content|main|post|entry|text|story|prose|markdown|readme)([-_\s]|$)/i

/** Cac block element duoc ghep thanh noi dung. */
const BLOCK_SELECTOR = 'p, li, pre, td, th, blockquote, h1, h2, h3, h4, h5, h6, dd, dt, figcaption'

/** Do dai toi thieu cua mot block de tinh la noi dung chinh. */
const MIN_BLOCK_LENGTH = 25

/** Nguong diem toi thieu de dung node tim duoc thay vi fallback body. */
const MIN_CONTENT_SCORE = 20

/**
 * Trich noi dung chinh cua trang.
 *
 * @param doc - Document can trich (mac dinh `document` cua content script).
 */
export function extractPageContent(doc: Document = document): ExtractedPage {
  const cloned = doc.cloneNode(true) as Document

  const title = readTitle(cloned)
  const byline = readByline(cloned)

  removeNoise(cloned)

  const candidate = findContentNode(cloned)

  if (candidate === null) {
    return {
      title,
      byline,
      url: cloned.location?.href ?? '',
      text: '',
      excerpt: '',
      strategy: 'empty',
      wordCount: 0,
    }
  }

  const text = collectText(candidate.node)

  if (text.length === 0) {
    return {
      title,
      byline,
      url: cloned.location?.href ?? '',
      text: '',
      excerpt: '',
      strategy: 'empty',
      wordCount: 0,
    }
  }

  return {
    title,
    byline,
    url: cloned.location?.href ?? '',
    text,
    excerpt: makeExcerpt(text),
    strategy: candidate.strategy,
    wordCount: countWords(text),
  }
}

/** Uu tien `og:title` → `<title>` → `<h1>`. */
function readTitle(doc: Document): string {
  const og = doc
    .querySelector('meta[property="og:title"]')
    ?.getAttribute('content')
    ?.trim()
  if (og !== undefined && og.length > 0) return og

  const docTitle = doc.title.trim()
  if (docTitle.length > 0) return docTitle

  const h1 = doc.querySelector('h1')?.textContent?.trim() ?? ''
  return h1
}

/** Tac gia tu `meta[name=author]` hoac `[rel=author]`. */
function readByline(doc: Document): string {
  const meta = doc
    .querySelector('meta[name="author"]')
    ?.getAttribute('content')
    ?.trim()
  if (meta !== undefined && meta.length > 0) return meta

  const rel = doc.querySelector('[rel="author"]')?.textContent?.trim() ?? ''
  return rel
}

/** Xoa script, style, va cac vung nhieu (nav/footer/sidebar/quang cao). */
function removeNoise(doc: Document): void {
  for (const tag of STRIPPED_TAGS) {
    doc.querySelectorAll(tag).forEach((node) => node.remove())
  }

  doc.querySelectorAll('[hidden]').forEach((node) => node.remove())
  doc
    .querySelectorAll('[aria-hidden="true"]')
    .forEach((node) => node.remove())
  doc
    .querySelectorAll('[role="navigation"], [role="banner"], [role="complementary"], [role="contentinfo"]')
    .forEach((node) => node.remove())

  // Phan tu co class/id khop mau am → thuong la khung ngoai, quang cao, comment.
  doc.querySelectorAll('[class], [id]').forEach((node) => {
    const signature = `${node.getAttribute('class') ?? ''} ${node.getAttribute('id') ?? ''}`
    if (NEGATIVE_PATTERN.test(signature)) {
      node.remove()
    }
  })
}

interface Candidate {
  node: Element
  score: number
  strategy: ExtractionStrategy
}

/**
 * Tim node chua noi dung chinh bang cach cham diem cac phan tinh kha dung.
 *
 * Diem:
 *  - cộng theo do dai text cua cac block con (> MIN_BLOCK_LENGTH)
 *  - trừ khi link density cao (trang danh sach link, khong phai bai viet)
 *  - cộng/trừ theo class/id (POSITIVE_PATTERN / NEGATIVE_PATTERN)
 *  - bonus cho the semantic `article` / `main`
 */
function findContentNode(doc: Document): Candidate | null {
  const nodes = doc.querySelectorAll('article, main, [role="main"], section, div')
  let best: Candidate | null = null

  for (const node of Array.from(nodes)) {
    const score = scoreNode(node)
    if (score <= 0) continue
    if (best === null || score > best.score) {
      best = { node, score, strategy: strategyOf(node) }
    }
  }

  if (best !== null && best.score >= MIN_CONTENT_SCORE) {
    return best
  }

  // Fallback: dung body cua trang.
  const body = doc.body
  if (body === null) return null

  const bodyText = collectText(body)
  if (bodyText.length === 0) return null

  return { node: body, score: 0, strategy: 'body' }
}

/** Cham diem mot phan tu. */
function scoreNode(node: Element): number {
  const blocks = Array.from(node.querySelectorAll(BLOCK_SELECTOR)).filter(
    (block) => (block.textContent ?? '').trim().length > MIN_BLOCK_LENGTH,
  )

  let score = 0
  for (const block of blocks) {
    score += (block.textContent ?? '').trim().length
  }

  // Link density cao → danh sach, khong phai noi dung doc.
  const totalText = (node.textContent ?? '').trim().length
  const linkText = Array.from(node.querySelectorAll('a'))
    .reduce((sum, link) => sum + (link.textContent ?? '').trim().length, 0)
  if (totalText > 0 && linkText / totalText > 0.5) {
    score -= score
  }

  const signature = `${node.getAttribute('class') ?? ''} ${node.getAttribute('id') ?? ''}`
  if (POSITIVE_PATTERN.test(signature)) {
    score += 50
  }
  if (NEGATIVE_PATTERN.test(signature)) {
    score -= 50
  }

  const tag = node.tagName.toLowerCase()
  if (tag === 'article') score += 40
  else if (tag === 'main') score += 30
  else if (node.getAttribute('role') === 'main') score += 25

  return score
}

/** Suy ra chien luoc tu the semantic cua node. */
function strategyOf(node: Element): ExtractionStrategy {
  const tag = node.tagName.toLowerCase()
  if (tag === 'article') return 'article'
  if (tag === 'main' || node.getAttribute('role') === 'main') return 'main'
  return 'body'
}

/**
 * Ghep text tu cac block element theo thu tu tai lieu.
 *
 * Dung `textContent` (khong dung `innerText`) vi node clone khong gan DOM →
 * `innerText` tra rong trong jsdom.
 */
function collectText(root: Element): string {
  const blocks = Array.from(root.querySelectorAll(BLOCK_SELECTOR))
  const parts: string[] = []
  const seen = new Set<Element>()

  for (const block of blocks) {
    if (seen.has(block)) continue
    // Bo qua block nam trong block da lay (tranh lap lai noi dung).
    let parent = block.parentElement
    let nested = false
    while (parent !== null && parent !== root) {
      if (seen.has(parent)) {
        nested = true
        break
      }
      parent = parent.parentElement
    }
    if (nested) continue

    seen.add(block)
    const text = normalizeWhitespace(block.textContent ?? '')
    if (text.length > 0) {
      parts.push(text)
    }
  }

  if (parts.length === 0) {
    // Node khong co block nao → dung toan bo text cua node.
    const raw = normalizeWhitespace(root.textContent ?? '')
    return raw.length > 0 ? truncate(raw) : ''
  }

  return truncate(parts.join('\n\n'))
}

/** Chuan hoa whitespace: thay khoang trang khong ngat, gop space, bo dong trong thua. */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Cat text tai gioi han, cat tai ranh giới tu (khong cat giua surrogate pair). */
function truncate(text: string): string {
  if (text.length <= LIMITS.MAX_PAGE_TEXT_CHARS) return text

  const slice = text.slice(0, LIMITS.MAX_PAGE_TEXT_CHARS)
  const lastSpace = slice.lastIndexOf(' ')
  const safe = lastSpace > LIMITS.MAX_PAGE_TEXT_CHARS * 0.8 ? slice.slice(0, lastSpace) : slice
  return safe.trimEnd()
}

/** Tao excerpt ngan, cat tai ranh giới tu. */
function makeExcerpt(text: string): string {
  if (text.length <= LIMITS.MAX_EXCERPT_CHARS) return text

  const slice = text.slice(0, LIMITS.MAX_EXCERPT_CHARS)
  const lastSpace = slice.lastIndexOf(' ')
  const safe = lastSpace > LIMITS.MAX_EXCERPT_CHARS * 0.6 ? slice.slice(0, lastSpace) : slice
  return `${safe.trimEnd()}...`
}

/** Dem so tu trong text. */
function countWords(text: string): number {
  const words = text.split(/\s+/).filter((word) => word.length > 0)
  return words.length
}
