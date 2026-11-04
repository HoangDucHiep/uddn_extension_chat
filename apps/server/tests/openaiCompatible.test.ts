import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpenAiCompatibleProvider } from '../src/providers/openaiCompatible.js'
import type { ProviderChunk } from '@sidekick/shared'

/**
 * Test cho adapter OpenAI-compatible (Groq / OpenRouter).
 *
 * Mock `fetch` de kiem chung: parse SSE stream, fallback model khi loi
 * tam thoi (404 / 429 / 5xx), va khong fallback khi loi khong retryable
 * (401 / 400).
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.4
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

/** Tao Response loi voi status cho truoc. */
function errorResponse(status: number, text = 'loi'): Response {
  return new Response(text, { status })
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
function makeProvider(overrides: Partial<ConstructorParameters<typeof OpenAiCompatibleProvider>[0]> = {}) {
  return new OpenAiCompatibleProvider({
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.test.local/v1',
    buildHeaders: (apiKey: string) => ({ Authorization: `Bearer ${apiKey}` }),
    defaultModel: 'default-model',
    preferredModels: ['preferred-1', 'preferred-2'],
    timeoutMs: 5_000,
    ...overrides,
  })
}

/** Request toi provider. */
const baseRequest = {
  model: 'requested-model',
  messages: [{ role: 'user' as const, content: 'Xin chao' }],
  apiKey: 'key-123',
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OpenAiCompatibleProvider.stream', () => {
  it('parse SSE thanh token chunks', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        JSON.stringify({ choices: [{ delta: { content: 'Xin ' } }] }),
        JSON.stringify({ choices: [{ delta: { content: 'chao' } }] }),
        '[DONE]',
      ]),
    )

    const chunks = await collect(makeProvider().stream(baseRequest))

    const tokens = chunks.filter((chunk) => chunk.kind === 'token')
    expect(tokens).toHaveLength(2)
    expect(tokens[0]).toMatchObject({ kind: 'token', text: 'Xin ' })
    expect(tokens[1]).toMatchObject({ kind: 'token', text: 'chao' })
    expect(chunks.some((chunk) => chunk.kind === 'done')).toBe(true)
  })

  it('doc usage tokens tu SSE', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }),
        JSON.stringify({ usage: { prompt_tokens: 11, completion_tokens: 7 } }),
        '[DONE]',
      ]),
    )

    const chunks = await collect(makeProvider().stream(baseRequest))

    const usage = chunks.find((chunk) => chunk.kind === 'usage')
    expect(usage).toMatchObject({ kind: 'usage', tokensIn: 11, tokensOut: 7 })
  })
  it('401 → error, KHONG fallback sang model khac', async () => {
    fetchMock.mockResolvedValue(errorResponse(401, 'unauthorized'))

    const chunks = await collect(makeProvider().stream(baseRequest))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const error = chunks.find((chunk) => chunk.kind === 'error')
    expect(error).toMatchObject({ kind: 'error', errorCode: 'INVALID_API_KEY' })
  })

  it('404 → fallback sang model uu tien tiep theo', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(404, 'model not found'))
      .mockResolvedValueOnce(
        sseResponse([JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }), '[DONE]']),
      )

    const chunks = await collect(makeProvider().stream(baseRequest))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const tokens = chunks.filter((chunk) => chunk.kind === 'token')
    expect(tokens).toHaveLength(1)
    expect(chunks.some((chunk) => chunk.kind === 'error')).toBe(false)
  })

  it('429 → fallback model (retryable)', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(429, 'rate limited'))
      .mockResolvedValueOnce(
        sseResponse([JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }), '[DONE]']),
      )

    const chunks = await collect(makeProvider().stream(baseRequest))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(chunks.some((chunk) => chunk.kind === 'error')).toBe(false)
  })

  it('500 → fallback model (retryable)', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(500, 'server error'))
      .mockResolvedValueOnce(
        sseResponse([JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }), '[DONE]']),
      )

    const chunks = await collect(makeProvider().stream(baseRequest))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(chunks.some((chunk) => chunk.kind === 'error')).toBe(false)
  })

  it('het model → yield error cuoi cung', async () => {
    fetchMock.mockResolvedValue(errorResponse(500, 'always down'))

    const chunks = await collect(makeProvider().stream(baseRequest))

    // requested-model + 2 preferred + default = 4 lan thu.
    expect(fetchMock).toHaveBeenCalledTimes(4)
    const error = chunks.find((chunk) => chunk.kind === 'error')
    expect(error).toMatchObject({ kind: 'error', errorCode: 'PROVIDER_UNAVAILABLE' })
  })

  it('model trong body request khi fallback', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(404))
      .mockResolvedValueOnce(
        sseResponse([JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }), '[DONE]']),
      )

    await collect(makeProvider().stream(baseRequest))

    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      model: string
    }
    expect(secondBody.model).toBe('preferred-1')
  })

  it('gui Authorization header tu apiKey', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }), '[DONE]']),
    )

    await collect(makeProvider().stream(baseRequest))

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer key-123')
  })

  it('error trong SSE payload → yield error chunk', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        JSON.stringify({ error: { message: 'model overloaded', code: 'PROVIDER_ERROR' } }),
        '[DONE]',
      ]),
    )

    const chunks = await collect(makeProvider().stream(baseRequest))

    const error = chunks.find((chunk) => chunk.kind === 'error')
    expect(error).toMatchObject({ kind: 'error', errorMessage: 'model overloaded' })
  })

  it('SSE JSON hong → bo qua, khong crash', async () => {
    fetchMock.mockResolvedValue(
      sseResponse(['khong phai json', JSON.stringify({ choices: [{ delta: { content: 'ok' } }] })]),
    )

    const chunks = await collect(makeProvider().stream(baseRequest))

    const tokens = chunks.filter((chunk) => chunk.kind === 'token')
    expect(tokens).toHaveLength(1)
  })

  it('resolveModel tra model mac dinh khi client khong chi dinh', () => {
    expect(makeProvider().resolveModel(undefined)).toBe('default-model')
    expect(makeProvider().resolveModel('my-model')).toBe('my-model')
  })

  it('listModels that bai → dung danh sach uu tien', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))

    const models = await makeProvider().listModels()

    expect(models).toEqual(['preferred-1', 'preferred-2'])
  })
})

