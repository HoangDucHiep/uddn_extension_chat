/**
 * Mock provider — khong can network, khong can key.
 *
 * Dung cho unit/integration/E2E test va demo offline.
 * Docs: docs/SYSTEM_DESIGN.md §7.1
 */

import type { ProviderChunk, ProviderStreamRequest } from '@sidekick/shared'
import { type ProviderAdapter } from './types.js'

export interface MockProviderOptions {
  /** Text se duoc stream ra. */
  response?: string
  /** Delay giua cac token (ms) — mo phong do tre TTFT. */
  delayMs?: number
  /** Token usage gia lap. */
  tokensIn?: number
  tokensOut?: number
}

const DEFAULT_RESPONSE =
  'Day la phan hoi mau tu MockProvider. Ban co the dung provider nay de kiem thu ' +
  'luong chat ma khong can mang hay API key nao.'

export class MockProvider implements ProviderAdapter {
  readonly id = 'mock'
  readonly name = 'Mock Provider'
  readonly requiresKey = false

  private readonly options: MockProviderOptions

  constructor(options: MockProviderOptions = {}) {
    this.options = options
  }

  async listModels(): Promise<string[]> {
    return ['mock-model']
  }

  async *stream(request: ProviderStreamRequest): AsyncGenerator<ProviderChunk, void, undefined> {
    const text = this.options.response ?? DEFAULT_RESPONSE
    const delayMs = this.options.delayMs ?? 10

    const words = text.match(/\S+\s*/g) ?? [text]

    for (const word of words) {
      if (request.signal?.aborted) {
        yield { kind: 'done', finishReason: 'aborted' }
        return
      }

      if (delayMs > 0) {
        await sleep(delayMs, request.signal)
      }

      yield { kind: 'token', text: word }
    }

    yield {
      kind: 'usage',
      tokensIn: this.options.tokensIn ?? estimateTokens(text),
      tokensOut: this.options.tokensOut ?? estimateTokens(text),
    }
    yield { kind: 'done', finishReason: 'stop' }
  }
}

/** Uoc luong so token (xa xi ~4 ky tu/token). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

/** Sleep co the bi huy bang AbortSignal. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort(): void {
      clearTimeout(timer)
      resolve()
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
