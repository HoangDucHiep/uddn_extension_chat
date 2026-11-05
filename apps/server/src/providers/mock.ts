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

  /** Mock "ho tro" vision de pipeline anh duoc kiem thu end-to-end. */
  supportsVision(_model: string): boolean {
    return true
  }

  /** Mock khong quan tam model — luon dung ten co dinh. */
  resolveModel(requestedModel?: string): string {
    return requestedModel ?? 'mock-model'
  }

  async *stream(request: ProviderStreamRequest): AsyncGenerator<ProviderChunk, void, undefined> {
    const text = this.options.response ?? DEFAULT_RESPONSE
    const delayMs = this.options.delayMs ?? 10

    // Echo so anh nhan duoc → E2E co bang chung anh di het pipeline toi
    // tang provider (FR-VISION-01 — T-M1-24).
    const imageCount = (request.messages ?? []).reduce(
      (sum, message) => sum + (message.attachments?.length ?? 0),
      0,
    )
    const imageNote =
      imageCount > 0
        ? ` [mock] Nhan duoc ${imageCount} anh (${describeImages(request.messages)})`
        : ''

    const words = `${text}${imageNote}`.match(/\S+\s*/g) ?? [text]

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

/**
 * Mo ta cac anh nhan duoc — dung cho echo cua mock.
 *
 * @param messages - Cac turn gui len provider.
 */
function describeImages(
  messages: readonly { attachments?: readonly { mimeType: string }[] | undefined }[],
): string {
  const types = messages.flatMap((message) =>
    (message.attachments ?? []).map((image) => image.mimeType),
  )
  return [...new Set(types)].join(', ')
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
