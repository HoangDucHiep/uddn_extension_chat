import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GeminiProvider } from '../src/providers/gemini.js'
import { createGroqProvider } from '../src/providers/groq.js'
import { OpenAiCompatibleProvider } from '../src/providers/openaiCompatible.js'
import { createOpenRouterProvider } from '../src/providers/openrouter.js'
import { MockProvider } from '../src/providers/mock.js'
import type { ProviderChunk } from '@sidekick/shared'

/**
 * Test provider co ho tro vision hay khong (FR-VISION-01 — T-M1-24).
 *
 * Kiem chung payload that:
 *  - Gemini → `parts` co `inline_data`
 *  - OpenAI-compatible → `content` co `image_url`
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.4
 */

const fetchMock = vi.fn()

/** Tao Response SSE gia lap. */
function sseResponse(lines: string[]): Response {
  const body = lines.map((line) => `data: ${line}\n\n`).join('')
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

/** Thu thap chunk. */
async function collect(
  generator: AsyncGenerator<ProviderChunk, void, undefined>,
): Promise<ProviderChunk[]> {
  const chunks: ProviderChunk[] = []
  for await (const chunk of generator) {
    chunks.push(chunk)
  }
  return chunks
}

/** Request co 1 anh. */
const requestWithImage = {
  model: 'gemini-3.6-flash',
  messages: [
    {
      role: 'user' as const,
      content: 'Mo ta anh nay',
      attachments: [{ mimeType: 'image/png' as const, data: 'aGVsbG8=' }],
    },
  ],
  apiKey: 'key-123',
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('supportsVision', () => {
  it('Gemini ho tro vision tren moi model', () => {
    const provider = new GeminiProvider({ defaultModel: 'gemini-3.6-flash' })
    expect(provider.supportsVision('gemini-3.6-flash')).toBe(true)
    expect(provider.supportsVision('bat-ky-model-nao')).toBe(true)
  })

  it('Mock ho tro vision (de E2E kiem chu pipeline)', () => {
    expect(new MockProvider().supportsVision('mock-model')).toBe(true)
  })

  it('Groq chi ho tro vision voi model trong danh sach', () => {
    const provider = createGroqProvider({ defaultModel: 'openai/gpt-oss-120b' })
    expect(provider.supportsVision('meta-llama/llama-4-scout-17b')).toBe(true)
    expect(provider.supportsVision('meta-llama/llama-3.2-90b-vision')).toBe(true)
    expect(provider.supportsVision('openai/gpt-oss-120b')).toBe(false)
  })

  it('OpenRouter ho tro vision voi model Gemini', () => {
    const provider = createOpenRouterProvider({ defaultModel: 'google/gemini-2.5-flash' })
    expect(provider.supportsVision('google/gemini-2.5-flash')).toBe(true)
    expect(provider.supportsVision('openai/gpt-4o')).toBe(true)
    expect(provider.supportsVision('some/unknown-model')).toBe(false)
  })

  it('provider khong khai bao vision → khong ho tro', () => {
    const provider = new OpenAiCompatibleProvider({
      id: 'x',
      name: 'X',
      baseUrl: 'https://api.test.local',
      buildHeaders: () => ({}),
      defaultModel: 'm',
      preferredModels: ['m'],
      timeoutMs: 1000,
    })
    expect(provider.supportsVision('m')).toBe(false)
  })
})

describe('GeminiProvider — payload inline_data', () => {
  it('anh duoc gui duoi dang inline_data', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })]),
    )

    const provider = new GeminiProvider({ defaultModel: 'gemini-3.6-flash' })
    await collect(provider.stream(requestWithImage))

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>
    }

    const parts = body.contents[0]?.parts ?? []
    expect(parts).toHaveLength(2)
    expect(parts[0]).toEqual({ text: 'Mo ta anh nay' })
    expect(parts[1]).toEqual({
      inline_data: { mime_type: 'image/png', data: 'aGVsbG8=' },
    })
  })

  it('khong co anh → chi 1 part text', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })]),
    )

    const provider = new GeminiProvider({ defaultModel: 'gemini-3.6-flash' })
    await collect(
      provider.stream({
        model: 'gemini-3.6-flash',
        messages: [{ role: 'user', content: 'Xin chao' }],
        apiKey: 'k',
      }),
    )

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      contents: Array<{ parts: unknown[] }>
    }
    expect(body.contents[0]?.parts).toHaveLength(1)
  })
})

describe('OpenAI-compatible — payload image_url', () => {
  it('anh duoc gui duoi dang image_url data url', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }), '[DONE]']),
    )

    const provider = createOpenRouterProvider({ defaultModel: 'google/gemini-2.5-flash' })
    await collect(provider.stream(requestWithImage))

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      messages: Array<{ role: string; content: unknown }>
    }

    const content = body.messages[0]?.content
    expect(Array.isArray(content)).toBe(true)
    if (!Array.isArray(content)) return

    expect(content[0]).toEqual({ type: 'text', text: 'Mo ta anh nay' })
    expect(content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,aGVsbG8=' },
    })
  })
})

describe('MockProvider — echo so anh', () => {
  it('bao ro so anh nhan duoc', async () => {
    const provider = new MockProvider()
    const chunks = await collect(provider.stream(requestWithImage))

    const text = chunks
      .filter((chunk) => chunk.kind === 'token')
      .map((chunk) => chunk.text ?? '')
      .join('')

    expect(text).toContain('1 anh')
    expect(text).toContain('image/png')
  })

  it('khong co anh → khong echo', async () => {
    const provider = new MockProvider()
    const chunks = await collect(
      provider.stream({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'Xin chao' }],
      }),
    )

    const text = chunks
      .filter((chunk) => chunk.kind === 'token')
      .map((chunk) => chunk.text ?? '')
      .join('')

    expect(text).not.toContain('anh (')
  })
})
