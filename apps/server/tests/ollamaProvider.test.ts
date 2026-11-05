import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createOllamaProvider,
  detectOllama,
  OLLAMA_DEFAULT_BASE_URL,
  OLLAMA_VISION_MODEL_PREFIXES,
} from '../src/providers/ollama.js'

/**
 * Unit test cho Ollama adapter + phat hien provider local (FR-PROVIDER-07 — T-M1-25).
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.4
 */

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createOllamaProvider', () => {
  it('khong can API key', () => {
    const provider = createOllamaProvider({ defaultModel: 'llama3.2' })
    expect(provider.requiresKey).toBe(false)
  })

  it('id va name dung chuan', () => {
    const provider = createOllamaProvider({ defaultModel: 'llama3.2' })
    expect(provider.id).toBe('ollama')
    expect(provider.name).toBe('Ollama')
  })

  it('resolveModel tra ve model mac dinh', () => {
    const provider = createOllamaProvider({ defaultModel: 'llama3.2' })
    expect(provider.resolveModel()).toBe('llama3.2')
    expect(provider.resolveModel('qwen2.5:7b')).toBe('qwen2.5:7b')
  })

  it('supportsVision theo tien to model', () => {
    const provider = createOllamaProvider({ defaultModel: 'llama3.2' })
    expect(provider.supportsVision('llama3.2-vision:11b')).toBe(true)
    expect(provider.supportsVision('llava:13b')).toBe(true)
    expect(provider.supportsVision('llama3.2:latest')).toBe(false)
  })

  it('dung base URL mac dinh khi khong truyen', () => {
    expect(OLLAMA_DEFAULT_BASE_URL).toBe('http://127.0.0.1:11434/v1')
  })
})

describe('OLLAMA_VISION_MODEL_PREFIXES', () => {
  it('chua it nhat mot tien to vision', () => {
    expect(OLLAMA_VISION_MODEL_PREFIXES.length).toBeGreaterThan(0)
    expect(OLLAMA_VISION_MODEL_PREFIXES).toContain('llava')
  })
})

describe('detectOllama', () => {
  it('available = true khi Ollama phan hoi danh sach model', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          { name: 'llama3.2:latest' },
          { name: 'qwen2.5:7b' },
          { khongCoTenModel: true },
        ],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await detectOllama('http://127.0.0.1:11434')

    expect(result.available).toBe(true)
    expect(result.models).toEqual(['llama3.2:latest', 'qwen2.5:7b'])
    expect(result.error).toBeUndefined()
    // Probe dung endpoint native cua Ollama.
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://127.0.0.1:11434/api/tags')
  })

  it('available = false khi Ollama khong phan hoi', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED')
      }),
    )

    const result = await detectOllama('http://127.0.0.1:11434')

    expect(result.available).toBe(false)
    expect(result.models).toEqual([])
    expect(result.error).toContain('Khong ket noi duoc Ollama')
  })

  it('available = false khi Ollama tra loi loi HTTP', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
      })),
    )

    const result = await detectOllama('http://127.0.0.1:11434')

    expect(result.available).toBe(false)
    expect(result.error).toContain('500')
  })

  it('bo qua suffix /v1 khi probe (base URL co the duoc truyen dang ky OpenAI)', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ models: [] }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    await detectOllama('http://127.0.0.1:11434/v1')

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://127.0.0.1:11434/api/tags')
  })

  it('payload khong phai object → models rong, khong throw', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => 'khong-phai-object',
      })),
    )

    const result = await detectOllama('http://127.0.0.1:11434')

    expect(result.available).toBe(true)
    expect(result.models).toEqual([])
  })
})
