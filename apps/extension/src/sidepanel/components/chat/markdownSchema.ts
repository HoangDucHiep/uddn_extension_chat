import { defaultSchema, type Options } from 'rehype-sanitize'

/**
 * Schema sanitize cho noi dung Markdown cua side panel (T-M1-07).
 *
 * Yeu cau:
 *  - Cho phep `span.hljs-*` + `code.hljs` de `rehype-highlight` giu duoc
 *    token mau (khong bi sanitize bo).
 *  - Chi cho phep protocol `http` / `https` / `mailto` cho `href`
 *    (bo `irc` / `xmpp` cua `defaultSchema`).
 *  - KHONG mutate `defaultSchema` cua `hast-util-sanitize` (module singleton).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.8
 */

/**
 * Schema cua `rehype-sanitize` cho Markdown.
 *
 * `attributes` va `protocols` cua `defaultSchema` bi **thay the** hoan toan
 * khi truyen vao `sanitize()` → phai merge thu cong de giu het quy tac mac
 * dinh (task list, footnote, table...).
 *
 * ## KaTeX (T-M3-POLISH)
 *
 * `rehype-katex` sinh ra **MathML** (`<math>`, `<semantics>`, `<mrow>`...)
 * + `<span class="katex…">` + `style` inline → `defaultSchema` se **xoa het**
 * → cong thuc toan ra thuoc text thoi. Phai mo allowlist cho:
 *  - `tagNames`: cac tag MathML.
 *  - `attributes`: `math[xmlns|display|encoding]` · `annotation[encoding]` ·
 *    `span[class^=katex]` + `span[style]` · `math[style]`.
 *
 * CSP hien tai (`script-src 'self'; object-src 'self'`) **khong** chan
 * `style` inline → cho phep `style` tren `span`/`math` an toan.
 */
export const markdownSchema: Options = {
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    // --- MathML (KaTeX) ---
    'math',
    'semantics',
    'annotation',
    'annotation-xml',
    'mrow',
    'mi',
    'mo',
    'mn',
    'ms',
    'mtext',
    'mspace',
    'msup',
    'msub',
    'msubsup',
    'mfrac',
    'msqrt',
    'mroot',
    'mtable',
    'mtr',
    'mtd',
    'mstyle',
    'munder',
    'mover',
    'munderover',
    'menclose',
    'mpadded',
    'mphantom',
    'merror',
    'mfenced',
  ],
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    // `rehype-highlight` them `hljs` vao `code` + `language-*` tu fence info.
    code: [['className', /^language-./, 'hljs']],
    // Token mau cua highlight.js deu co tien to `hljs-`.
    // `katex-*` la class cua KaTeX (T-M3-POLISH).
    span: [['className', /^hljs-/, /^katex/], 'dataCitationIndex', 'style'],
    // KaTeX: MathML goc + thuoc tinh hien thi.
    math: ['xmlns', 'display', 'encoding', 'style'],
    annotation: ['encoding'],
    'annotation-xml': ['encoding'],
    // KaTeX dat `style` tren `math` va cac node MathML con.
    mrow: ['style'],
    mi: ['style'],
    mo: ['style'],
    mn: ['style'],
    mtext: ['style'],
    mspace: ['style'],
    msup: ['style'],
    msub: ['style'],
    msubsup: ['style'],
    mfrac: ['style'],
    msqrt: ['style'],
    mstyle: ['style'],
    mtable: ['style'],
    mtr: ['style'],
    mtd: ['style'],
    munder: ['style'],
    mover: ['style'],
    munderover: ['style'],
  },
  protocols: {
    ...(defaultSchema.protocols ?? {}),
    href: ['http', 'https', 'mailto'],
  },
}

/**
 * Ngon ngu chuan → danh sach alias (truyen cho option `aliases` cua
 * `rehype-highlight` → `lowlight.registerAlias`).
 *
 * Chi khai bao nhung alias **chua** co san trong highlight.js (vd `vue`,
 * `dockerfile`, `http`) va mot so alias chung de tai dinh nghia.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.8
 */
export const LANGUAGE_ALIASES: Readonly<Record<string, ReadonlyArray<string>>> = {
  javascript: ['js', 'jsx', 'mjs', 'cjs'],
  typescript: ['ts', 'tsx', 'mts', 'cts'],
  python: ['py', 'ipython'],
  ruby: ['rb'],
  bash: ['sh', 'zsh'],
  yaml: ['yml'],
  xml: ['html', 'xhtml', 'svg', 'rss', 'atom', 'vue'],
  csharp: ['cs', 'c#'],
  cpp: ['c++', 'cc', 'hpp', 'hxx'],
  go: ['golang'],
  rust: ['rs'],
  kotlin: ['kt', 'kts'],
  markdown: ['md'],
  plaintext: ['txt', 'text', 'dockerfile', 'http'],
  shell: ['console', 'shellsession'],
  ini: ['toml'],
  makefile: ['make', 'mk'],
  objectivec: ['objc', 'mm'],
  perl: ['pl', 'pm'],
  diff: ['patch'],
  graphql: ['gql'],
  lua: ['pluto'],
  'python-repl': ['pycon'],
  vbnet: ['vb'],
}

/**
 * Danh sach ngon ngu chuan duoc ho tro (grammar co trong `lowlight.common`).
 *
 * Dung cho test + hien thi nhan ngon ngu.
 */
export const SUPPORTED_LANGUAGES: ReadonlyArray<string> = [
  'arduino',
  'bash',
  'c',
  'cpp',
  'csharp',
  'css',
  'diff',
  'go',
  'graphql',
  'ini',
  'java',
  'javascript',
  'json',
  'kotlin',
  'less',
  'lua',
  'makefile',
  'markdown',
  'objectivec',
  'perl',
  'php',
  'php-template',
  'plaintext',
  'python',
  'python-repl',
  'r',
  'ruby',
  'rust',
  'scss',
  'shell',
  'sql',
  'swift',
  'typescript',
  'vbnet',
  'wasm',
  'xml',
  'yaml',
]

/**
 * Node hast (rut gon) — dung de doc `className` va text ma khong can import
 * truc tiep type `hast` (package khong phai dependency truc tiep cua app).
 */
export interface MarkdownNode {
  readonly type: string
  readonly tagName?: string
  readonly properties?: Readonly<Record<string, unknown>>
  readonly children?: ReadonlyArray<MarkdownNode>
  readonly value?: string
}

/**
 * Ep `unknown` thanh `MarkdownNode` (khong phai element → `undefined`).
 *
 * @param value - Gia tri can ep.
 * @returns Node hop le hoac `undefined`.
 */
export function toMarkdownNode(value: unknown): MarkdownNode | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const candidate = value as { type?: unknown }
  if (typeof candidate.type !== 'string') return undefined
  return value as MarkdownNode
}

/**
 * Doc danh sach class cua node (hast luu class trong `properties.className`).
 *
 * @param node - Node hast.
 * @returns Danh sach class (rong neu khong co).
 */
function classNamesOf(node: MarkdownNode | undefined): string[] {
  const raw = node?.properties?.['className']
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string')
  }
  if (typeof raw === 'string') {
    return raw.split(/\s+/).filter((item) => item.length > 0)
  }
  return []
}

/**
 * Lay ngon ngu cua code block tu node hast `pre` (> `code[class=language-*]`).
 *
 * @param node - Node hast cua `pre` (hoac `code`).
 * @returns Ten ngon ngu (vd `typescript`) hoac `undefined`.
 */
export function languageFromNode(node: unknown): string | undefined {
  const root = toMarkdownNode(node)
  if (root === undefined) return undefined

  const codeElement =
    root.tagName === 'code'
      ? root
      : root.children?.find((child) => child.tagName === 'code')

  for (const className of classNamesOf(codeElement)) {
    if (className.startsWith('language-')) {
      const language = className.slice('language-'.length)
      return language.length > 0 ? language : undefined
    }
    if (className.startsWith('lang-')) {
      const language = className.slice('lang-'.length)
      return language.length > 0 ? language : undefined
    }
  }

  return undefined
}

/**
 * Lay source code tho tu node hast `pre` (bo qua markup highlight).
 *
 * @param node - Node hast cua `pre`.
 * @returns Source code (chuoi rong neu khong co).
 */
export function extractCodeText(node: unknown): string {
  const root = toMarkdownNode(node)
  if (root === undefined) return ''

  let result = ''

  const walk = (current: MarkdownNode): void => {
    if (current.type === 'text') {
      result += current.value ?? ''
      return
    }
    for (const child of current.children ?? []) {
      walk(child)
    }
  }

  walk(root)

  return result
}
