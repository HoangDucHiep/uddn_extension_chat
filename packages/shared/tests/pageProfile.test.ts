import { describe, expect, it } from 'vitest'

import {
  PAGE_PROFILES,
  classifyPage,
  generalSuggestions,
  rotateSuggestions,
  suggestionsForPage,
} from '../src/pageProfile.js'

describe('classifyPage', () => {
  it('phan loai pdf khi URL ket thuc .pdf', () => {
    expect(classifyPage('https://example.com/docs/report.pdf')).toBe('pdf')
  })

  it('phan loai youtube la video', () => {
    expect(classifyPage('https://www.youtube.com/watch?v=abc123')).toBe('video')
    expect(classifyPage('https://youtu.be/abc123')).toBe('video')
  })

  it('phan loai stackoverflow / reddit la forum', () => {
    expect(classifyPage('https://stackoverflow.com/questions/1/how')).toBe('forum')
    expect(classifyPage('https://www.reddit.com/r/typescript')).toBe('forum')
  })

  it('phan loai mdn / docs.* la docs', () => {
    expect(classifyPage('https://developer.mozilla.org/en-US/docs/Web/API')).toBe('docs')
    expect(classifyPage('https://docs.expressjs.com/intro')).toBe('docs')
  })

  it('phan loai github blob la docs', () => {
    expect(classifyPage('https://github.com/nodejs/node/blob/main/README.md')).toBe('docs')
  })

  it('phan loai arxiv / medium la article', () => {
    expect(classifyPage('https://arxiv.org/abs/1706.03762')).toBe('article')
    expect(classifyPage('https://medium.com/some/post-abc')).toBe('article')
  })

  it('phan loai amazon / shopify la shopping', () => {
    expect(classifyPage('https://www.amazon.com/dp/B0TEST')).toBe('shopping')
    expect(classifyPage('https://shopify.com/products')).toBe('shopping')
  })

  it('fallback general cho trang binh thuong', () => {
    expect(classifyPage('https://example.com/')).toBe('general')
    expect(classifyPage('https://example.com/some/random/page')).toBe('general')
  })

  it('tra general cho trang noi bo trinh duyet', () => {
    expect(classifyPage('chrome://extensions')).toBe('general')
    expect(classifyPage('chrome://newtab')).toBe('general')
    expect(classifyPage('file:///C:/temp/a.pdf')).toBe('general')
  })

  it('tra general cho URL khong hop le', () => {
    expect(classifyPage('')).toBe('general')
    expect(classifyPage('not a url')).toBe('general')
  })

  it('khong phan loai theo path khi host uu tien dung', () => {
    // stackoverflow la forum du duong dan co chua "/docs/"
    expect(classifyPage('https://stackoverflow.com/docs/question')).toBe('forum')
  })

  it('dung title lam fallback khi host/path khong khop', () => {
    expect(classifyPage('https://example.com/page', 'API Documentation')).toBe('docs')
  })

  it('chi tra cac profile nam trong PAGE_PROFILES', () => {
    for (const profile of PAGE_PROFILES) {
      expect(PAGE_PROFILES).toContain(profile)
    }
  })
})

describe('suggestionsForPage', () => {
  it('moi profile co it nhat 3 goi y', () => {
    for (const profile of PAGE_PROFILES) {
      const suggestions = suggestionsForPage(profile, 'Trang mau')
      expect(suggestions.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('dien dung placeholder {title} bang tieu de trang', () => {
    const suggestions = suggestionsForPage('docs', 'React Hooks')
    expect(suggestions.length).toBeGreaterThan(0)
    for (const suggestion of suggestions) {
      expect(suggestion.prompt).not.toContain('{title}')
      expect(suggestion.prompt).toContain('React Hooks')
    }
  })

  it('khong con placeholder khi tieu de rong (dung ten chung)', () => {
    const suggestions = suggestionsForPage('article', '   ')
    for (const suggestion of suggestions) {
      expect(suggestion.prompt).not.toContain('{title}')
    }
  })

  it('co id duy nhat trong 1 bo goi y', () => {
    const suggestions = suggestionsForPage('forum', 'Cau hoi')
    const ids = suggestions.map((suggestion) => suggestion.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('profile general tra ve bo goi y chung', () => {
    expect(suggestionsForPage('general', 'X')).toEqual(generalSuggestions())
  })
})

describe('generalSuggestions', () => {
  it('co it nhat 3 goi y va khong phu thuoc trang', () => {
    const suggestions = generalSuggestions()
    expect(suggestions.length).toBeGreaterThanOrEqual(3)
    for (const suggestion of suggestions) {
      expect(suggestion.prompt.length).toBeGreaterThan(0)
      expect(suggestion.label.length).toBeGreaterThan(0)
    }
  })
})

describe('rotateSuggestions', () => {
  it('xoay vong deterministic theo offset', () => {
    const base = generalSuggestions()
    const rotated = rotateSuggestions(base, 1)
    expect(rotated).toHaveLength(base.length)
    expect(rotated[0]?.id).toBe(base[1]?.id)
    expect(rotateSuggestions(base, 1)).toEqual(rotated)
  })

  it('offset 0 giu nguyen thu tu', () => {
    const base = generalSuggestions()
    expect(rotateSuggestions(base, 0)).toEqual(base)
  })

  it('offset lon hon do dai khong loi', () => {
    const base = generalSuggestions()
    expect(rotateSuggestions(base, base.length)).toEqual(base)
  })

  it('mang rong tra ve mang rong', () => {
    expect(rotateSuggestions([], 3)).toEqual([])
  })
})
