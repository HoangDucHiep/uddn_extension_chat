import { describe, expect, it } from 'vitest'
import {
  buildExportFileName,
  buildJsonExport,
  buildMarkdownExport,
  EXPORT_FORMAT_VERSION,
  type ExportConversation,
} from '../src/lib/export'

/**
 * Tao fixture conversation de test.
 *
 * @param overrides - Cac truong ghi de.
 */
function conversation(overrides: Partial<ExportConversation> = {}): ExportConversation {
  return {
    id: 'conv-1',
    title: 'Cuộc trò chuyện thử nghiệm',
    exportedAt: new Date('2026-11-09T01:30:00.000Z'),
    messages: [
      {
        role: 'user',
        content: 'Xin chào, hỏi thử một câu',
        createdAt: Date.parse('2026-11-09T01:29:00.000Z'),
      },
      {
        role: 'assistant',
        content: 'Chào bạn! Tôi có thể giúp gì?',
        createdAt: Date.parse('2026-11-09T01:29:05.000Z'),
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        tokensIn: 120,
        tokensOut: 45,
        requestId: 'abcdef123456',
        citations: [
          {
            index: 1,
            url: 'https://example.com/doc',
            title: 'Tài liệu ví dụ',
            snippet: 'Đoạn trích dẫn',
          },
        ],
      },
    ],
    ...overrides,
  }
}

describe('export', () => {
  describe('buildMarkdownExport', () => {
    it('gom metadata conversation vao dau file', () => {
      const markdown = buildMarkdownExport(conversation())

      expect(markdown).toContain('# Cuộc trò chuyện thử nghiệm')
      expect(markdown).toContain('- Xuất lúc: 2026-11-09T01:30:00.000Z')
      expect(markdown).toContain('- Conversation ID: conv-1')
      expect(markdown).toContain('- Số tin nhắn: 2')
    })

    it('ghi role + noi dung cua tung message', () => {
      const markdown = buildMarkdownExport(conversation())

      expect(markdown).toContain('## Người dùng')
      expect(markdown).toContain('Xin chào, hỏi thử một câu')
      expect(markdown).toContain('## Trợ lý')
      expect(markdown).toContain('Chào bạn! Tôi có thể giúp gì?')
    })

    it('ghi metadata provider/model/token/request-id cho message assistant', () => {
      const markdown = buildMarkdownExport(conversation())

      expect(markdown).toContain('gemini · gemini-2.0-flash')
      expect(markdown).toContain('120/45 tokens')
      expect(markdown).toContain('req abcdef')
    })

    it('ghi danh sach nguon trich dan theo marker [N]', () => {
      const markdown = buildMarkdownExport(conversation())

      expect(markdown).toContain('- [1] [Tài liệu ví dụ](https://example.com/doc)')
    })

    it('bo qua message rong (khong tao heading trong)', () => {
      const markdown = buildMarkdownExport(
        conversation({
          messages: [
            { role: 'user', content: '   ', createdAt: Date.parse('2026-11-09T01:29:00.000Z') },
          ],
        }),
      )

      expect(markdown).not.toContain('## Người dùng')
      expect(markdown).toContain('- Số tin nhắn: 1')
    })

    it('van sinh duoc file khi conversation rong', () => {
      const markdown = buildMarkdownExport(conversation({ id: undefined, title: '', messages: [] }))

      expect(markdown).toContain('# Cuộc trò chuyện')
      expect(markdown).toContain('- Số tin nhắn: 0')
      expect(markdown.endsWith('\n')).toBe(true)
    })

    it('giu nguyen ky tu dac biet trong noi dung Markdown', () => {
      const markdown = buildMarkdownExport(
        conversation({
          messages: [
            {
              role: 'user',
              content: 'Dòng 1\nDòng 2 **đậm** `code` | bảng',
              createdAt: Date.parse('2026-11-09T01:29:00.000Z'),
            },
          ],
        }),
      )

      expect(markdown).toContain('Dòng 1\nDòng 2 **đậm** `code` | bảng')
    })
  })

  describe('buildJsonExport', () => {
    it('co version + exportedAt + conversation', () => {
      const json = buildJsonExport(conversation())

      expect(json.version).toBe(EXPORT_FORMAT_VERSION)
      expect(json.exportedAt).toBe('2026-11-09T01:30:00.000Z')
      expect(json.conversation).toEqual({
        id: 'conv-1',
        title: 'Cuộc trò chuyện thử nghiệm',
      })
    })

    it('chuyen doi tung message sang shape JSON', () => {
      const json = buildJsonExport(conversation())
      const messages = json.messages

      expect(messages).toHaveLength(2)
      expect(messages[0]).toEqual({
        role: 'user',
        content: 'Xin chào, hỏi thử một câu',
        createdAt: '2026-11-09T01:29:00.000Z',
      })
      expect(messages[1]).toMatchObject({
        role: 'assistant',
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        tokensIn: 120,
        tokensOut: 45,
        requestId: 'abcdef123456',
      })
      expect(messages[1]?.citations).toEqual([
        {
          index: 1,
          url: 'https://example.com/doc',
          title: 'Tài liệu ví dụ',
          snippet: 'Đoạn trích dẫn',
        },
      ])
    })

    it('khong them field undefined khi message khong co metadata', () => {
      const json = buildJsonExport(
        conversation({
          messages: [
            {
              role: 'assistant',
              content: 'abc',
              createdAt: Date.parse('2026-11-09T01:29:00.000Z'),
            },
          ],
        }),
      )
      const messages = json.messages

      expect(messages[0]).not.toHaveProperty('provider')
      expect(messages[0]).not.toHaveProperty('citations')
    })

    it('serializable bang JSON.stringify', () => {
      const json = buildJsonExport(conversation())

      expect(() => JSON.stringify(json)).not.toThrow()
    })
  })

  describe('buildExportFileName', () => {
    it('sinh ten file co tieu de + timestamp + duoi file', () => {
      const name = buildExportFileName('Hoi bai', 'md', new Date('2026-11-09T01:30:00.000Z'))

      expect(name).toMatch(/^sidekick-Hoi bai-\d{8}-\d{4}\.md$/)
    })

    it('loai bo ky tu khong hop le cho Windows', () => {
      const name = buildExportFileName('a/b\\c:d*e?f"g<h>i|j', 'json', new Date())

      expect(name).not.toMatch(/[<>:"/\\|?*]/)
      expect(name.endsWith('.json')).toBe(true)
    })

    it('fallback ve "conversation" khi tieu de rong', () => {
      const name = buildExportFileName('   ', 'md', new Date())

      expect(name).toMatch(/^sidekick-conversation-\d{8}-\d{4}\.md$/)
    })

    it('cat tieu de qua dai', () => {
      const name = buildExportFileName('x'.repeat(200), 'md', new Date())

      expect(name.length).toBeLessThan(120)
    })
  })
})
