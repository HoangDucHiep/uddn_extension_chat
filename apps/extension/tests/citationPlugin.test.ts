import { describe, expect, it } from 'vitest'
import { citationPlugin, transformCitationMarkers } from '../src/sidepanel/components/chat/citationPlugin.js'

/**
 * Unit test cho remark plugin trich dan (FR-CONTEXT-10 — T-M1-08).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.9
 */

/** Node mdast rut gon cho test. */
interface TestNode {
  type: string
  value?: string
  children?: TestNode[]
  data?: {
    hName?: string
    hProperties?: Record<string, unknown>
  }
}

/** Tao node text. */
function text(value: string): TestNode {
  return { type: 'text', value }
}

/** Lay cac node co `dataCitationIndex` trong cay. */
function collectCitationNodes(node: TestNode): TestNode[] {
  const found: TestNode[] = []
  if (node.data?.hProperties?.['dataCitationIndex'] !== undefined) {
    found.push(node)
  }
  for (const child of node.children ?? []) {
    found.push(...collectCitationNodes(child))
  }
  return found
}

/** Lay toan bo text cua cay (de kiem tra noi dung con nguyen). */
function collectText(node: TestNode): string {
  let result = node.value ?? ''
  for (const child of node.children ?? []) {
    result += collectText(child)
  }
  return result
}

describe('transformCitationMarkers', () => {
  it('tach marker trong 1 text node', () => {
    const node: TestNode = {
      type: 'paragraph',
      children: [text('Gia do la 30% [1].')],
    }

    transformCitationMarkers(node)

    const citations = collectCitationNodes(node)
    expect(citations).toHaveLength(1)
    expect(citations[0]?.data?.hProperties?.['dataCitationIndex']).toBe(1)
    expect(citations[0]?.data?.hName).toBe('span')
  })

  it('giu nguyen text truoc va sau marker', () => {
    const node: TestNode = {
      type: 'paragraph',
      children: [text('Gia do la 30% [1].')],
    }

    transformCitationMarkers(node)

    expect(collectText(node)).toBe('Gia do la 30% [1].')
  })

  it('tach nhieu marker trong cung 1 text node', () => {
    const node: TestNode = {
      type: 'paragraph',
      children: [text('a [1] b [2] c [3]')],
    }

    transformCitationMarkers(node)

    const citations = collectCitationNodes(node)
    expect(citations.map((item) => item.data?.hProperties?.['dataCitationIndex'])).toEqual([
      1, 2, 3,
    ])
  })

  it('text khong co marker → khong doi', () => {
    const node: TestNode = {
      type: 'paragraph',
      children: [text('Khong trich dan gi ca')],
    }

    transformCitationMarkers(node)

    expect(node.children).toHaveLength(1)
    expect(node.children?.[0]?.data).toBeUndefined()
  })

  it('KHONG dung vao code block', () => {
    const node: TestNode = {
      type: 'code',
      value: 'const a = arr[1]',
    }

    transformCitationMarkers(node)

    expect(node.data).toBeUndefined()
    expect(node.value).toBe('const a = arr[1]')
  })

  it('KHONG dung vao inline code', () => {
    const node: TestNode = {
      type: 'inlineCode',
      value: 'arr[1]',
    }

    transformCitationMarkers(node)

    expect(node.data).toBeUndefined()
    expect(node.value).toBe('arr[1]')
  })

  it('code block long hon 1 text node → giu nguyen', () => {
    const node: TestNode = {
      type: 'code',
      children: [text('x [1] y')],
    }

    transformCitationMarkers(node)

    expect(collectCitationNodes(node)).toHaveLength(0)
  })

  it('de quy xuong cac node con', () => {
    const node: TestNode = {
      type: 'blockquote',
      children: [
        {
          type: 'paragraph',
          children: [text('trong trich dan [2]')],
        },
      ],
    }

    transformCitationMarkers(node)

    const citations = collectCitationNodes(node)
    expect(citations).toHaveLength(1)
    expect(citations[0]?.data?.hProperties?.['dataCitationIndex']).toBe(2)
  })

  it('bo qua marker khong phai so', () => {
    const node: TestNode = {
      type: 'paragraph',
      children: [text('Xem [abc] o day')],
    }

    transformCitationMarkers(node)

    expect(collectCitationNodes(node)).toHaveLength(0)
    expect(node.children).toHaveLength(1)
  })

  it('bo qua so 0', () => {
    const node: TestNode = {
      type: 'paragraph',
      children: [text('so [0]')],
    }

    transformCitationMarkers(node)

    expect(collectCitationNodes(node)).toHaveLength(0)
  })
})

describe('citationPlugin', () => {
  it('tra ve transformer nhan 1 node', () => {
    const transformer = citationPlugin()
    const node: TestNode = { type: 'paragraph', children: [text('x [1]')] }

    const result = transformer(node as never)

    expect(result).toBe(node)
    expect(collectCitationNodes(node)).toHaveLength(1)
  })
})
