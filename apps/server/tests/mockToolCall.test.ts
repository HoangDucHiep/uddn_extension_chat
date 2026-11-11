import { describe, expect, it } from 'vitest'
import type { ProviderChunk } from '@sidekick/shared'
import { MockProvider } from '../src/providers/mock.js'

/**
 * Test cho mock provider (T-M2-07 — FR-TOOLS-02).
 *
 * AC goc:
 * - "Mock duoc cau hinh tool call → tra tool call".
 * - "Luot goi provider thu 2 (sau khi tool chay) → tra text cuoi cung".
 *
 * Mock la kenh **offline** de E2E test tool loop khong can API key.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.26.5
 */

/** Thu thap tat ca chunk tu generator. */
async function collect(
  generator: AsyncGenerator<ProviderChunk, void, undefined>,
): Promise<ProviderChunk[]> {
  const chunks: ProviderChunk[] = []
  for await (const chunk of generator) {
    chunks.push(chunk)
  }
  return chunks
}

/** Request co `tools` + 1 user turn. */
const toolRequest = {
  model: 'mock-model',
  messages: [{ role: 'user' as const, content: 'Tinh 2+2' }],
  tools: [
    {
      name: 'calculator',
      description: 'Tinh bieu thuc',
      parameters: { type: 'object' as const, properties: {} },
    },
  ],
}

describe('MockProvider — tool calling', () => {
  it('supportsTools = true', () => {
    expect(new MockProvider().supportsTools).toBe(true)
  })

  it('duoc cau hinh tool call → tra chunk tool_call + done("tool")', async () => {
    const provider = new MockProvider({
      toolCall: { name: 'calculator', args: { expression: '2+2' } },
    })

    const chunks = await collect(provider.stream(toolRequest))

    const toolCall = chunks.find((chunk) => chunk.kind === 'tool_call')
    expect(toolCall).toMatchObject({
      kind: 'tool_call',
      name: 'calculator',
      args: { expression: '2+2' },
    })
    expect(chunks.find((chunk) => chunk.kind === 'done')).toMatchObject({
      finishReason: 'tool',
    })
  })

  it('request KHONG co tools → khong tra tool call', async () => {
    const provider = new MockProvider({
      toolCall: { name: 'calculator', args: { expression: '2+2' } },
    })

    const chunks = await collect(
      provider.stream({ model: 'mock-model', messages: toolRequest.messages }),
    )

    expect(chunks.some((chunk) => chunk.kind === 'tool_call')).toBe(false)
    expect(chunks.some((chunk) => chunk.kind === 'token')).toBe(true)
  })

  it('messages co turn `tool` → tra text cuoi cung (vong 2)', async () => {
    const provider = new MockProvider({
      toolCall: { name: 'calculator', args: { expression: '2+2' } },
      toolFinalResponse: 'Ket qua la 4.',
    })

    const chunks = await collect(
      provider.stream({
        ...toolRequest,
        messages: [
          ...toolRequest.messages,
          { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'calculator', args: {} }] },
          { role: 'tool', content: '4', toolCallId: 'c1' },
        ],
      }),
    )

    expect(chunks.some((chunk) => chunk.kind === 'tool_call')).toBe(false)
    const tokens = chunks.filter((chunk) => chunk.kind === 'token')
    expect(tokens.length).toBeGreaterThan(0)
    expect(tokens.map((chunk) => chunk.text).join('')).toContain('Ket qua la 4.')
  })

  it('khong duoc cau hinh tool call → stream text binh thuong', async () => {
    const provider = new MockProvider({ response: 'Xin chao' })

    const chunks = await collect(provider.stream(toolRequest))

    expect(chunks.some((chunk) => chunk.kind === 'tool_call')).toBe(false)
    const tokens = chunks.filter((chunk) => chunk.kind === 'token')
    expect(tokens.map((chunk) => chunk.text).join('')).toContain('Xin chao')
  })
})
