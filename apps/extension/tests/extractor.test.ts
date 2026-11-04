import { describe, expect, it } from 'vitest'
import { LIMITS } from '@sidekick/shared'
import { extractPageContent } from '../src/content/extractor.js'

/**
 * Test cho extractor Readability-lite.
 *
 * Dung `DOMParser` de tao Document doc lap — khong phu thuoc DOM cua jsdom.
 * Docs: docs/SYSTEM_DESIGN.md §7 (Unit test)
 */

/** Tao Document tu chuoi HTML. */
function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

describe('extractPageContent', () => {
  it('lay noi dung chinh tu <article>, bo qua nav/sidebar/footer', () => {
    const doc = parseHtml(`
      <html>
        <head><title>Bai blog ve AI</title></head>
        <body>
          <nav class="site-nav"><a href="/">Trang chu</a><a href="/blog">Blog</a></nav>
          <div class="sidebar"><p>Quang cao hay biet</p><p>Dieu huong phu</p></div>
          <article class="post-content">
            <h1>Tieu de bai viet</h1>
            <p>Doan van dau cua bai viet, noi dung chinh cua trang day.</p>
            <p>Doan van thu hai, van la noi dung chinh cua trang.</p>
          </article>
          <footer>Chu ky ban quyen</footer>
        </body>
      </html>
    `)

    const result = extractPageContent(doc)

    expect(result.strategy).toBe('article')
    expect(result.text).toContain('Doan van dau cua bai viet')
    expect(result.text).toContain('Doan van thu hai')
    expect(result.text).not.toContain('Trang chu')
    expect(result.text).not.toContain('Quang cao hay biet')
    expect(result.text).not.toContain('Chu ky ban quyen')
    expect(result.wordCount).toBeGreaterThan(0)
  })

  it('dung <main> khi trang khong co <article>', () => {
    const doc = parseHtml(`
      <html>
        <body>
          <main role="main">
            <p>Tai lieu chinh thuc cua san pham, noi dung huong dan day du.</p>
            <p>Phan thu hai cua tai lieu huong dan su dung san pham.</p>
          </main>
        </body>
      </html>
    `)

    const result = extractPageContent(doc)

    expect(result.strategy).toBe('main')
    expect(result.text).toContain('Tai lieu chinh thuc')
  })

  it('fallback ve body khi trang khong co landmark', () => {
    const doc = parseHtml(`
      <html>
        <body>
          <div>
            <p>Mot trang don gian chi co vai doan van ngay trong body.</p>
            <p>Doan van thu hai de du body co du noi dung de tinh diem.</p>
          </div>
        </body>
      </html>
    `)

    const result = extractPageContent(doc)

    expect(result.strategy).toBe('body')
    expect(result.text).toContain('Mot trang don gian')
  })

  it('tra strategy empty khi trang khong co noi dung', () => {
    const doc = parseHtml('<html><body></body></html>')

    const result = extractPageContent(doc)

    expect(result.strategy).toBe('empty')
    expect(result.text).toBe('')
    expect(result.excerpt).toBe('')
    expect(result.wordCount).toBe(0)
  })

  it('uu tien og:title va lay byline tu meta author', () => {
    const doc = parseHtml(`
      <html>
        <head>
          <title>Tieu de trong the title</title>
          <meta property="og:title" content="Tieu de Open Graph" />
          <meta name="author" content="Nguyen Van A" />
        </head>
        <body>
          <article><p>Noi dung bai viet de test tieu de va tac gia.</p></article>
        </body>
      </html>
    `)

    const result = extractPageContent(doc)

    expect(result.title).toBe('Tieu de Open Graph')
    expect(result.byline).toBe('Nguyen Van A')
  })

  it('cat text dai tai gioi han va chuan hoa whitespace', () => {
    const longParagraph = 'Doan van rat dai. '.repeat(6000)
    const doc = parseHtml(`
      <html>
        <body>
          <article><p>${longParagraph}</p></article>
        </body>
      </html>
    `)

    const result = extractPageContent(doc)

    expect(result.text.length).toBeLessThanOrEqual(LIMITS.MAX_PAGE_TEXT_CHARS)
    expect(result.text.length).toBeGreaterThan(LIMITS.MAX_PAGE_TEXT_CHARS * 0.9)
    expect(result.excerpt.length).toBeLessThanOrEqual(LIMITS.MAX_EXCERPT_CHARS + 3)
    expect(result.text).not.toContain('\u00a0')
    expect(result.text).not.toMatch(/[ \t]{2,}/)
  })

  it('bo qua block nam trong block da lay (khong lap lai noi dung)', () => {
    const doc = parseHtml(`
      <html>
        <body>
          <article>
            <p>Doan van dau, mot doan day du de tinh diem cho node.</p>
            <div><p>Doan van nam trong div con, cung thuoc noi dung chinh.</p></div>
          </article>
        </body>
      </html>
    `)

    const result = extractPageContent(doc)

    expect(result.text).toContain('Doan van dau')
    expect(result.text).toContain('Doan van nam trong div con')
    const occurrences = result.text.split('Doan van dau').length - 1
    expect(occurrences).toBe(1)
  })

  it('khong mutate DOM goc cua trang', () => {
    const doc = parseHtml(`
      <html>
        <body>
          <nav class="site-nav"><a href="/">Trang chu</a></nav>
          <article><p>Noi dung can giu nguyen trong DOM goc.</p></article>
        </body>
      </html>
    `)

    extractPageContent(doc)

    expect(doc.querySelector('nav')).not.toBeNull()
    expect(doc.querySelector('article')).not.toBeNull()
  })

  it('FALLBACK THAT: khi moi node diem < 20 → dung body', () => {
    // Moi block < MIN_BLOCK_LENGTH (25) → moi node diem 0 → khong co candidate
    // → phai fallback sang body. Neu nhanh fallback bi xoa, ket qua se la
    // strategy 'empty' va test nay fail.
    const doc = parseHtml(`
      <html>
        <body>
          <div>
            <p>Ngan.</p>
            <p>Van ngan.</p>
            <p>Van ngan nua.</p>
          </div>
        </body>
      </html>
    `)

    const result = extractPageContent(doc)

    expect(result.strategy).toBe('body')
    expect(result.text).toContain('Ngan.')
    expect(result.text).toContain('Van ngan nua.')
    expect(result.wordCount).toBeGreaterThan(0)
  })

  it('dedup block long: blockquote chua <p> khong bi lap noi dung', () => {
    const doc = parseHtml(`
      <html>
        <body>
          <article>
            <p>Doan van dau cua bai viet, noi dung chinh cua trang day.</p>
            <blockquote><p>Trich dan trong blockquote, do la noi dung trich.</p></blockquote>
            <p>Doan van cuoi cua bai viet, van la noi dung chinh cua trang.</p>
          </article>
        </body>
      </html>
    `)

    const result = extractPageContent(doc)

    expect(result.text).toContain('Trich dan trong blockquote')
    // Noi dung blockquote chi xuat hien MOT lan (khong bi lap do <p> ben trong).
    const occurrences = result.text.split('Trich dan trong blockquote').length - 1
    expect(occurrences).toBe(1)
  })

  it('loai bo vung nhieu (class/id am) NGUOI TRONG candidate node', () => {
    const doc = parseHtml(`
      <html>
        <body>
          <article class="post">
            <p>Doan van chinh cua bai viet, noi dung dung de tinh diem.</p>
            <div class="ad-banner"><p>Quang cao nen bi loai bo khoi noi dung chinh.</p></div>
            <div class="comment"><p>Comment cua nguoi dung cung bi loai bo.</p></div>
          </article>
        </body>
      </html>
    `)

    const result = extractPageContent(doc)

    expect(result.strategy).toBe('article')
    expect(result.text).toContain('Doan van chinh cua bai viet')
    expect(result.text).not.toContain('Quang cao nen bi loai bo')
    expect(result.text).not.toContain('Comment cua nguoi dung')
  })

  it('bien: trang chi co <title> → text rong, strategy empty', () => {
    const doc = parseHtml(`
      <html>
        <head><title>Chi co tieu de</title></head>
        <body></body>
      </html>
    `)

    const result = extractPageContent(doc)

    expect(result.title).toBe('Chi co tieu de')
    expect(result.strategy).toBe('empty')
    expect(result.text).toBe('')
    expect(result.wordCount).toBe(0)
  })

  it('bien: trang chi co <h1> → lay text h1 qua fallback body', () => {
    const doc = parseHtml(`
      <html>
        <head><title>Tieu de</title></head>
        <body>
          <h1>Tieu de don</h1>
        </body>
      </html>
    `)

    const result = extractPageContent(doc)

    expect(result.strategy).toBe('body')
    expect(result.text).toBe('Tieu de don')
    expect(result.wordCount).toBe(3)
  })

  it('bien: trang link density cao → khong coi la bai viet', () => {
    const links = Array.from(
      { length: 12 },
      (_value, index) => `<a href="/muc-${index}">Muc so ${index}</a>`,
    ).join('')

    const doc = parseHtml(`
      <html>
        <body>
          <div class="link-list">${links}</div>
        </body>
      </html>
    `)

    const result = extractPageContent(doc)

    // Diem bi truong 0 → fallback body, khong dung nhanh "article".
    expect(result.strategy).toBe('body')
    expect(result.text).toContain('Muc so 0')
    expect(result.wordCount).toBeGreaterThan(0)
  })
})
