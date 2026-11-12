import { describe, expect, it } from 'vitest'
import {
  decodeHtmlEntities,
  htmlToText,
  normalizeWhitespace,
  sha256Content,
  snapshotPathFor,
  truncateText,
} from '../src/snapshot.js'

/**
 * Test bo tach snapshot (T-M2-12).
 *
 * AC goc:
 *  - HTML → text bo script/style/nav/footer (vung nhieu).
 *  - Uu tien `<article>` / `<main>` truoc `<body>`.
 *  - Hash **deterministic** — cung noi dung → cung hash.
 *  - Cat text tai ranh gioi tu.
 *
 * Docs: docs/EVAL_PLAN.md §3.4
 */

const HTML = `<!doctype html>
<html>
<head>
  <title>Tieu de</title>
  <style>.a { color: red }</style>
  <script>console.log('x')</script>
</head>
<body>
  <nav>Menu truong</nav>
  <article>
    <h1>Tieu de bai</h1>
    <p>Doan van thu nhat co du chieu dai de khong bi lo.</p>
    <p>Doan van thu hai chua so lieu 87% va bang 1234.</p>
  </article>
  <footer>Chan trang</footer>
</body>
</html>`

describe('htmlToText', () => {
  it('lay noi dung tu <article>', () => {
    const text = htmlToText(HTML)
    expect(text).toContain('Tieu de bai')
    expect(text).toContain('Doan van thu nhat')
  })

  it('bo script / style / nav / footer', () => {
    const text = htmlToText(HTML)
    expect(text).not.toContain("console.log")
    expect(text).not.toContain('color: red')
    expect(text).not.toContain('Menu truong')
    expect(text).not.toContain('Chan trang')
  })

  it('bo comment HTML', () => {
    const text = htmlToText('<body><!-- binh thuong --><p>Noi dung</p></body>')
    expect(text).not.toContain('binh thuong')
    expect(text).toContain('Noi dung')
  })

  it('fallback sang <body> khi khong co <article>', () => {
    const text = htmlToText('<body><p>Chi co body</p></body>')
    expect(text).toContain('Chi co body')
  })

  it('tach block thanh dong rieng', () => {
    const text = htmlToText('<article><p>Dong mot</p><p>Dong hai</p></article>')
    expect(text).toContain('Dong mot')
    expect(text).toContain('Dong hai')
    expect(text.indexOf('Dong mot')).toBeLessThan(text.indexOf('Dong hai'))
  })

  it('giu con so nguyen quan trong', () => {
    const text = htmlToText(HTML)
    expect(text).toContain('87%')
    expect(text).toContain('1234')
  })
})

describe('decodeHtmlEntities', () => {
  it('giai ma named entity', () => {
    expect(decodeHtmlEntities('a &amp; b &lt;c&gt; &quot;d&quot;')).toBe('a & b <c> "d"')
  })

  it('giai ma numeric entity (thap phan + hex)', () => {
    expect(decodeHtmlEntities('&#39;&#x27;')).toBe("''")
  })

  it('giai ma entity dac biet tieng Viet', () => {
    expect(decodeHtmlEntities('&ldquo;x&rdquo; &ndash; &hellip;')).toBe('“x” – …')
  })

  it('giu nguyen entity la', () => {
    expect(decodeHtmlEntities('&unknownentity;')).toBe('&unknownentity;')
  })
})

describe('normalizeWhitespace', () => {
  it('ghep space va bo dong trong thua', () => {
    expect(normalizeWhitespace('a   b\n\n\n\nc')).toBe('a b\n\nc')
  })

  it('chuyen nbsp thanh space thuong', () => {
    expect(normalizeWhitespace('a\u00a0b')).toBe('a b')
  })
})

describe('truncateText', () => {
  it('khong cat ngan chua vuot gioi han', () => {
    expect(truncateText('ngan', 100)).toBe('ngan')
  })

  it('cat tai ranh gioi tu khi vuot gioi han', () => {
    const result = truncateText('aaaa bbbb cccc dddd', 10)
    expect(result.length).toBeLessThanOrEqual(10)
    expect(result.endsWith('bbbb')).toBe(true)
    expect(result).not.toContain('cccc')
  })
})

describe('sha256Content', () => {
  it('deterministic — cung noi dung ra cung hash', () => {
    expect(sha256Content('abc')).toBe(sha256Content('abc'))
  })

  it('noi dung khac → hash khac', () => {
    expect(sha256Content('abc')).not.toBe(sha256Content('abd'))
  })

  it('co tien to sha256:', () => {
    expect(sha256Content('abc')).toMatch(/^sha256:[0-9a-f]{64}$/)
  })
})

describe('snapshotPathFor', () => {
  it('sinh duong dan trong dataset/snapshots', () => {
    expect(snapshotPathFor('wikipedia-vi-python')).toBe(
      'apps/eval/dataset/snapshots/wikipedia-vi-python.txt',
    )
  })
})
