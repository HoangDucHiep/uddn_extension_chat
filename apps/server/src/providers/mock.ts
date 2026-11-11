/**
 * Mock provider — khong can network, khong can key.
 *
 * Dung cho unit/integration/E2E test va demo offline.
 * Docs: docs/SYSTEM_DESIGN.md §7.1
 */

import type { ProviderChunk, ProviderStreamRequest } from '@sidekick/shared'
import { type ProviderAdapter, type ProviderKeyCheck } from './types.js'

export interface MockProviderOptions {
  /** Text se duoc stream ra. */
  response?: string
  /** Delay giua cac token (ms) — mo phong do tre TTFT. */
  delayMs?: number
  /** Token usage gia lap. */
  tokensIn?: number
  tokensOut?: number
  /**
   * Tool call gia lap (FR-TOOLS-02 — T-M2-07).
   *
   * Khi request co `tools` **va** option nay duoc dat → mock tra tool call
   * thay vi text. Luot goi provider thu 2 (sau khi tool da chay) → mock
   * tra text cuoi cung (nhan biet qua `tool` turn trong messages).
   *
   * Day la kenh **offline** de test agent loop khong can API key.
   */
  toolCall?: { name: string; args: Record<string, unknown> }
  /**
   * Text tra ve o luot goi provider **thu 2** (sau khi tool da chay).
   *
   * Mac dinh: `DEFAULT_TOOL_FINAL_RESPONSE`.
   */
  toolFinalResponse?: string
}

const DEFAULT_RESPONSE =
  'Day la phan hoi mau tu MockProvider. Ban co the dung provider nay de kiem thu ' +
  'luong chat ma khong can mang hay API key nao.'

/** Text tra ve sau khi tool da chay xong. */
const DEFAULT_TOOL_FINAL_RESPONSE =
  'Da chay xong tool va day la phan hoi cuoi cung tu MockProvider.'

export class MockProvider implements ProviderAdapter {
  readonly id = 'mock'
  readonly name = 'Mock Provider'
  readonly requiresKey = false
  /** Mock ho tro function calling → phuc vu test agent loop offline (T-M2-07). */
  readonly supportsTools = true

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

  /** Mock khong can key → luon hop le. */
  async testKey(_apiKey: string): Promise<ProviderKeyCheck> {
    return { ok: true }
  }

  /** Mock khong quan tam model — luon dung ten co dinh. */
  resolveModel(requestedModel?: string): string {
    return requestedModel ?? 'mock-model'
  }

  async *stream(request: ProviderStreamRequest): AsyncGenerator<ProviderChunk, void, undefined> {
    const delayMs = this.options.delayMs ?? 10

    // --- Tool calling (FR-TOOLS-02 — T-M2-07) ---
    // Mock duoc cau hinh tool call + request co `tools` + chua co turn `tool`
    // (nghia la server chua chay tool) → mock tra tool call.
    const hasToolResult = (request.messages ?? []).some(
      (message) => message.role === 'tool',
    )
    const configuredTool = this.options.toolCall
    if (
      configuredTool !== undefined &&
      request.tools !== undefined &&
      request.tools.length > 0 &&
      !hasToolResult
    ) {
      yield {
        kind: 'tool_call',
        toolCallId: 'mock-tool-call-1',
        name: configuredTool.name,
        args: configuredTool.args,
      }
      yield { kind: 'done', finishReason: 'tool' }
      return
    }

    // Luot thu 2 (tool da chay) → tra phan hoi cuoi cung.
    const text = hasToolResult
      ? this.options.toolFinalResponse ?? DEFAULT_TOOL_FINAL_RESPONSE
      : this.options.response ?? DEFAULT_RESPONSE

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
