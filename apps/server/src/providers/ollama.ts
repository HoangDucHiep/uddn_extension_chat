/**
 * Ollama adapter — provider local, chay tren may nguoi dung.
 *
 * Ollama expose API tuong thich OpenAI tai `/v1` (mac dinh
 * `http://127.0.0.1:11434/v1`) → dung chung `OpenAiCompatibleProvider`.
 *
 * Khac biet so voi provider cloud: **khong can API key** → `requiresKey = false`
 * → `chatService` bo qua qua trinh resolve key.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.4, FR-PROVIDER-07 (che do offline)
 */

import { OpenAiCompatibleProvider } from './openaiCompatible.js'

/** Base URL mac dinh cua Ollama (API tuong thich OpenAI). */
export const OLLAMA_DEFAULT_BASE_URL = 'http://127.0.0.1:11434/v1'

/**
 * Tien to model cua Ollama ho tro vision (FR-VISION-01 — T-M1-24).
 *
 * Ollama hien cac model vision bang ten chua `:` va phan tach tag,
 * vi du `llama3.2-vision:11b` → tien to `llama3.2-vision`.
 */
export const OLLAMA_VISION_MODEL_PREFIXES = [
  'llama3.2-vision',
  'llava',
  'bakllava',
  'qwen2-vl',
  'qwen2.5-vl',
  'minicpm-v',
  'moondream',
  'gemma3',
] as const

/** Timeout cho probe phat hien Ollama (ms) — phai nganh de onboarding khong treo. */
export const OLLAMA_DETECT_TIMEOUT_MS = 1_500

export interface OllamaProviderOptions {
  baseUrl?: string
  defaultModel: string
  preferredModels?: string[]
  timeoutMs?: number
}

/**
 * Tao provider Ollama.
 *
 * `requiresKey = false` → khong gui header Authorization.
 */
export function createOllamaProvider(options: OllamaProviderOptions): OpenAiCompatibleProvider {
  const baseUrl = (options.baseUrl ?? OLLAMA_DEFAULT_BASE_URL).replace(/\/$/, '')
  return new OpenAiCompatibleProvider({
    id: 'ollama',
    name: 'Ollama',
    baseUrl,
    // Ollama local khong can key → header rong.
    buildHeaders: () => ({}),
    requiresKey: false,
    defaultModel: options.defaultModel,
    preferredModels: options.preferredModels ?? [options.defaultModel],
    timeoutMs: options.timeoutMs ?? 120_000,
    visionModelPrefixes: [...OLLAMA_VISION_MODEL_PREFIXES],
  })
}

/** Ket qua phat hien Ollama local. */
export interface OllamaDetection {
  /** Ollama co phan hoi hay khong. */
  available: boolean
  /** Danh sach model dang co tren Ollama (rong neu khong phat hien duoc). */
  models: string[]
  /** Thong diep loi tieng Viet (neu khong phat hien duoc). */
  error: string | undefined
}

/**
 * Phat hien Ollama local co chay hay khong.
 *
 * Probe `GET /api/tags` (endpoint native cua Ollama, tra ve danh sach model).
 * Timeout nganh → onboarding khong bi treo khi user chua bat Ollama.
 *
 * @param baseUrl - Base URL goc cua Ollama (khong co `/v1`).
 * @param timeoutMs - Timeout probe (ms).
 */
export async function detectOllama(
  baseUrl: string,
  timeoutMs: number = OLLAMA_DETECT_TIMEOUT_MS,
): Promise<OllamaDetection> {
  const root = baseUrl.replace(/\/$/, '').replace(/\/v1$/, '')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${root}/api/tags`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    if (!response.ok) {
      return {
        available: false,
        models: [],
        error: `Ollama trả lời ${response.status}`,
      }
    }

    const payload: unknown = await response.json()
    const models = extractModelNames(payload)

    return { available: true, models, error: undefined }
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError'
    return {
      available: false,
      models: [],
      error: isAbort
        ? 'Ollama không phản hồi (timeout)'
        : `Không kết nối được Ollama tại ${root}`,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Lay danh sach ten model tu payload `/api/tags`.
 *
 * Shape: `{ models: [{ name: 'llama3.2:latest', ... }] }`.
 *
 * Chi chap nhan object co truong `name` la chuoi — bare string bi bo qua
 * de mot payload hong nham khong lam lo danh sach model.
 */
function extractModelNames(payload: unknown): string[] {
  if (typeof payload !== 'object' || payload === null) return []
  const models = (payload as { models?: unknown }).models
  if (!Array.isArray(models)) return []

  return models
    .map((model) => {
      if (typeof model !== 'object' || model === null) return ''
      const name = (model as { name?: unknown }).name
      return typeof name === 'string' ? name : ''
    })
    .filter((name) => name.length > 0)
}
