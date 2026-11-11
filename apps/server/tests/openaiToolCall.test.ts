import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProviderChunk } from '@sidekick/shared'
import {
  OpenAiCompatibleProvider,
  parseToolArguments,
} from '../src/providers/openaiCompatible.js'

/**
 * Test cho tool calling cua adapter OpenAI-compatible (T-M2-07 — FR-TOOLS-02).
 *
 * AC goc:
 * - "Gom partial JSON theo `index` roi `JSON.parse`".
 * - "Body request co `tools` khi request.tools khac rong".
 * - "`finish_reason: 'tool_calls'` → `finishReason: 'tool'`".
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.26.5
 */

const fetchMock = vi.fn()

/** Tao Response SSE gia lap tu danh sach dong `data:`. */
function sseResponse(lines: string[]): Response {
  const body = lines.map((line) => `data: ${line}\n\n`).join('')
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

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

/** Tao provider de test voi baseUrl gia lap. */
function makeProvider(): OpenAiCompatibleProvider {
  return new OpenAiCompatibleProvider({
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.test.local/v1',
    buildHeaders: (apiKey: string) => ({ Authorization: `Bearer ${apiKey}` }),
    defaultModel: 'default-model',
    preferredModels: ['preferred-1'],
    timeoutMs: 5_000,
  })
}

/** Request toi provider. */
const baseRequest = {
  model: 'requested-model',
  messages: [{ role: 'user' as const, content: 'Tinh 2+2' }],
  apiKey: 'key-123',
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OpenAiCompatibleProvider — tool call streaming', () => {
  it('gom partial JSON theo index → args dung', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: 'call_abc', function: { name: 'calculator', arguments: '{"exp' } },
                ],
              },
            },
          ],
        }),
        JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [{ index: 0, function: { arguments: 'ression":"2+2"}' } }],
              },
            },
          ],
        }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
        '[DONE]',
      ]),
    )

    const chunks = await collect(makeProvider().stream(baseRequest))

    const toolCall = chunks.find((chunk) => chunk.kind === 'tool_call')
    expect(toolCall).toMatchObject({
      kind: 'tool_call',
      toolCallId: 'call_abc',
      name: 'calculator',
      args: { expression: '2+2' },
    })
  })

  it('nhieu tool call → tach theo index', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: 'c0', function: { name: 'alpha', arguments: '{"x":1}' } },
                ],
              },
            },
          ],
        }),
        JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 1, id: 'c1', function: { name: 'beta', arguments: '{"y":2}' } },
                ],
              },
            },
          ],
        }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
        '[DONE]',
      ]),
    )

    const chunks = await collect(makeProvider().stream(baseRequest))

    const toolCalls = chunks.filter((chunk) => chunk.kind === 'tool_call')
    expect(toolCalls).toHaveLength(2)
    expect(toolCalls[0]).toMatchObject({ name: 'alpha', args: { x: 1 } })
    expect(toolCalls[1]).toMatchObject({ name: 'beta', args: { y: 2 } })
  })

  it('finish_reason tool_calls → finishReason "tool"', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: 'c0', function: { name: 'alpha', arguments: '{}' } },
                ],
              },
            },
          ],
        }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
        '[DONE]',
      ]),
    )

    const chunks = await collect(makeProvider().stream(baseRequest))

    const done = chunks.find((chunk) => chunk.kind === 'done')
    expect(done).toMatchObject({ kind: 'done', finishReason: 'tool' })
  })

  it('arguments khong phai JSON hop le → args = {} (khong crash)', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: 'c0', function: { name: 'alpha', arguments: '{invalid' } },
                ],
              },
            },
          ],
        }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
        '[DONE]',
      ]),
    )

    const chunks = await collect(makeProvider().stream(baseRequest))

    const toolCall = chunks.find((chunk) => chunk.kind === 'tool_call')
    expect(toolCall).toMatchObject({ name: 'alpha', args: {} })
  })
})

describe('OpenAiCompatibleProvider — gui tools len provider', () => {
  it('request co tools → body chua `tools` + `tool_choice: auto`', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }), '[DONE]']),
    )

    await collect(
      makeProvider().stream({
        ...baseRequest,
        tools: [
          {
            name: 'calculator',
            description: 'Tinh bieu thuc',
            parameters: {
              type: 'object',
              properties: { expression: { type: 'string' } },
              required: ['expression'],
            },
          },
        ],
      }),
    )

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      tools?: Array<{ type: string; function: { name: string } }>
      tool_choice?: string
    }
    expect(body.tool_choice).toBe('auto')
    expect(body.tools?.[0]?.type).toBe('function')
    expect(body.tools?.[0]?.function.name).toBe('calculator')
  })

  it('request khong co tools → body KHONG co `tools`', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }), '[DONE]']),
    )

    await collect(makeProvider().stream(baseRequest))

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      tools?: unknown
    }
    expect(body.tools).toBeUndefined()
  })

  it('supportsTools = true (OpenAI-compatible ho tro function calling)', () => {
    expect(makeProvider().supportsTools).toBe(true)
  })
})

describe('parseToolArguments', () => {
  it('chuoi rong → {}', () => {
    expect(parseToolArguments('')).toEqual({})
  })

  it('chuoi co whitespace → {}', () => {
    expect(parseToolArguments('   ')).toEqual({})
  })

  it('JSON hop le → object', () => {
    expect(parseToolArguments('{"a":1}')).toEqual({ a: 1 })
  })

  it('JSON hong → {}', () => {
    expect(parseToolArguments('{invalid')).toEqual({})
  })

  it('JSON la array → {}', () => {
    expect(parseToolArguments('[1,2]')).toEqual({})
  })

  it('JSON la primitive → {}', () => {
    expect(parseToolArguments('42')).toEqual({})
  })
})
