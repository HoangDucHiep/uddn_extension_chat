import { describe, expect, it } from 'vitest'
import {
  extractCodeText,
  languageFromNode,
  LANGUAGE_ALIASES,
  markdownSchema,
  SUPPORTED_LANGUAGES,
  toMarkdownNode,
} from '../src/sidepanel/components/chat/markdownSchema.js'

/**
 * Unit test cho schema sanitize + helper AST cua Markdown (T-M1-07).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.8
 */

/** Node hast gia lap cho `pre > code[class=language-*]`. */
function makePreNode(language?: string, code = 'const a = 1'): unknown {
  return {
    type: 'element',
    tagName: 'pre',
    properties: {},
    children: [
      {
        type: 'element',
        tagName: 'code',
        properties: language === undefined ? {} : { className: [`language-${language}`] },
        children: [{ type: 'text', value: code }],
      },
    ],
  }
}

describe('markdownSchema', () => {
  it('cho phep span co class hljs-* (token mau cua syntax highlight)', () => {
    const spanRule = markdownSchema.attributes?.['span']
    expect(spanRule).toBeDefined()

    const classRule = spanRule?.find((entry) => Array.isArray(entry) && entry[0] === 'className')
    expect(classRule).toBeDefined()
    expect(Array.isArray(classRule)).toBe(true)
    if (!Array.isArray(classRule)) return

    const matcher = classRule[1]
    expect(matcher instanceof RegExp).toBe(true)
    if (!(matcher instanceof RegExp)) return

    expect(matcher.test('hljs-keyword')).toBe(true)
    expect(matcher.test('hljs-string')).toBe(true)
    expect(matcher.test('evil-class')).toBe(false)
  })

  it('cho phep code co class language-* va hljs', () => {
    const codeRule = markdownSchema.attributes?.['code']
    expect(codeRule).toBeDefined()

    const classRule = codeRule?.find((entry) => Array.isArray(entry) && entry[0] === 'className')
    expect(Array.isArray(classRule)).toBe(true)
    if (!Array.isArray(classRule)) return

    const matcher = classRule[1]
    expect(matcher instanceof RegExp).toBe(true)
    if (!(matcher instanceof RegExp)) return

    expect(matcher.test('language-typescript')).toBe(true)
    expect(classRule).toContain('hljs')
  })

  it('gioi han protocol href chi http/https/mailto', () => {
    expect(markdownSchema.protocols?.['href']).toEqual(['http', 'https', 'mailto'])
  })

  it('giu nguyen tagNames cua default schema (khong bo table/thead/td)', () => {
    // `defaultSchema` khong export `tagNames` qua `rehype-sanitize` →
    // schema cua ta khong override → van dung mac dinh cua hast-util-sanitize.
    expect(markdownSchema.tagNames).toBeUndefined()
    expect(markdownSchema.strip).toBeUndefined()
  })

  it('khong mutate defaultSchema cua hast-util-sanitize', async () => {
    const { defaultSchema } = await import('rehype-sanitize')

    expect(defaultSchema.protocols?.['href']).toContain('irc')
    expect(defaultSchema.protocols?.['href']).toContain('xmpp')
    expect(defaultSchema.attributes?.['span']).toBeUndefined()
  })
})

describe('LANGUAGE_ALIASES', () => {
  it('mo khoa ngon ngu chuan co trong lowlight.common', () => {
    for (const language of Object.keys(LANGUAGE_ALIASES)) {
      expect(SUPPORTED_LANGUAGES).toContain(language)
    }
  })

  it('khong trung ten ngon ngu chuan (tranh highlight sai)', () => {
    for (const [language, aliases] of Object.entries(LANGUAGE_ALIASES)) {
      expect(aliases).not.toContain(language)
    }
  })

  it('co alias pho bien: ts, py, sh, yml, rb', () => {
    expect(LANGUAGE_ALIASES['typescript']).toContain('ts')
    expect(LANGUAGE_ALIASES['python']).toContain('py')
    expect(LANGUAGE_ALIASES['bash']).toContain('sh')
    expect(LANGUAGE_ALIASES['yaml']).toContain('yml')
    expect(LANGUAGE_ALIASES['ruby']).toContain('rb')
  })
})

describe('toMarkdownNode', () => {
  it('tra undefined cho gia tri khong phai node', () => {
    expect(toMarkdownNode(undefined)).toBeUndefined()
    expect(toMarkdownNode(null)).toBeUndefined()
    expect(toMarkdownNode('x')).toBeUndefined()
    expect(toMarkdownNode({})).toBeUndefined()
  })

  it('tra node hop le', () => {
    expect(toMarkdownNode({ type: 'element' })).toBeDefined()
  })
})

describe('languageFromNode', () => {
  it('lay ngon ngu tu class language-*', () => {
    expect(languageFromNode(makePreNode('typescript'))).toBe('typescript')
  })

  it('lay ngon ngu tu class lang-*', () => {
    expect(
      languageFromNode({
        type: 'element',
        tagName: 'pre',
        properties: {},
        children: [
          {
            type: 'element',
            tagName: 'code',
            properties: { className: ['lang-python'] },
            children: [],
          },
        ],
      }),
    ).toBe('python')
  })

  it('tra undefined khi khong co class ngon ngu', () => {
    expect(languageFromNode(makePreNode(undefined))).toBeUndefined()
  })

  it('tra undefined cho node khong hop le', () => {
    expect(languageFromNode(undefined)).toBeUndefined()
    expect(languageFromNode('nope')).toBeUndefined()
  })
})

describe('extractCodeText', () => {
  it('lay source code tho', () => {
    expect(extractCodeText(makePreNode('ts', 'const a = 1'))).toBe('const a = 1')
  })

  it('noi nhieu text node', () => {
    expect(
      extractCodeText({
        type: 'element',
        tagName: 'pre',
        properties: {},
        children: [
          {
            type: 'element',
            tagName: 'code',
            properties: {},
            children: [
              { type: 'text', value: 'a' },
              { type: 'text', value: 'b' },
            ],
          },
        ],
      }),
    ).toBe('ab')
  })

  it('tra chuoi rong cho node khong hop le', () => {
    expect(extractCodeText(undefined)).toBe('')
  })
})
