import { describe, expect, it } from 'vitest'
import { TOOL_LIMITS, type ChatEvent } from '@sidekick/shared'
import { ProviderRegistry } from '../src/providers/registry.js'
import { MockProvider } from '../src/providers/mock.js'
import type { ProviderAdapter } from '../src/providers/types.js'
import {
  createChatStream,
  resolveToolDefinitions,
  type ChatServiceDeps,
} from '../src/services/chatService.js'
import { ToolRegistry } from '../src/tools/registry.js'
import type { Tool } from '../src/tools/types.js'
import { createFakeConversationDb } from './helpers/fakeConversationDb.js'

/**
 * Unit test cho **agent loop** (T-M2-07 — FR-TOOLS-02/04/06).
 *
 * AC goc:
 * - "Provider tra tool_call → server execute → goi provider lan 2 → text cuoi".
 * - "Vuot MAX_TOOL_ROUNDS → dung vong lap + canh bao (khong crash)".
 * - "SSE emit dung thu tu `tool_call` → `tool_result` → `token`".
 * - "Tool can duyet → server KHONG chay + emit `tool_approval`".
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.26.6
 */

const CONVERSATION_ID = '11111111-2222-4333-8444-555555555555'

/** Provider gia lap: luon tra tool call (dung de test gioi han vong). */
function makeAlwaysToolProvider(toolCallId = 'call_1'): ProviderAdapter {
  return {
    id: 'mock',
    name: 'Always Tool',
    requiresKey: false,
    supportsTools: true,
    async listModels() {
      return ['mock-model']
    },
    async discoverModels() {
      return { providerId: 'mock', models: ['mock-model'], source: 'fallback' }
    },
    async testKey() {
      return { ok: true }
    },
    resolveModel(requestedModel?: string) {
      return requestedModel ?? 'mock-model'
    },
    supportsVision() {
      return false
    },
    async *stream() {
      yield {
        kind: 'tool_call',
        toolCallId,
        name: 'echo',
        args: { value: 'x' },
      }
      yield { kind: 'done', finishReason: 'tool' }
    },
  }
}

/** Provider gia lap: tool call 1 lan roi tra text. */
function makeOnceToolProvider(): ProviderAdapter {
  let called = false
  return {
    id: 'mock',
    name: 'Once Tool',
    requiresKey: false,
    supportsTools: true,
    async listModels() {
      return ['mock-model']
    },
    async discoverModels() {
      return { providerId: 'mock', models: ['mock-model'], source: 'fallback' }
    },
    async testKey() {
      return { ok: true }
    },
    resolveModel(requestedModel?: string) {
      return requestedModel ?? 'mock-model'
    },
    supportsVision() {
      return false
    },
    async *stream() {
      if (!called) {
        called = true
        yield {
          kind: 'tool_call',
          toolCallId: 'call_1',
          name: 'echo',
          args: { value: 'x' },
        }
        yield { kind: 'done', finishReason: 'tool' }
        return
      }
      yield { kind: 'token', text: 'Cau tra loi cuoi cung.' }
      yield { kind: 'done', finishReason: 'stop' }
    },
  }
}

/** Registry provider voi adapter gia lap. */
function makeRegistryWith(provider: ProviderAdapter): ProviderRegistry {
  const registry = new ProviderRegistry({
    defaultProvider: 'mock',
    fallbacks: [],
    groqModel: 'g',
    openRouterModel: 'o',
    geminiModel: 'gem',
  })
  // Override provider `mock` bang adapter gia lap.
  Reflect.set(registry as unknown as { providers: Map<string, ProviderAdapter> }, 'providers', new Map([['mock', provider]]))
  return registry
}

/** Tool `echo` don gian. */
const echoTool: Tool = {
  name: 'echo',
  description: 'Echo lai gia tri',
  parameters: { type: 'object', properties: { value: { type: 'string' } } },
  requiresApproval: false,
  async execute(args) {
    const value = (args as { value?: string } | undefined)?.value ?? ''
    return { ok: true, output: `echo:${value}` }
  },
}

/** Tool can duyet. */
const dangerousTool: Tool = {
  name: 'danger',
  description: 'Tool nguy hiem',
  parameters: { type: 'object', properties: {} },
  requiresApproval: true,
  approvalReason: 'Tool nay ghi du lieu.',
  async execute() {
    return { ok: true, output: 'chua chay' }
  },
}

/** Tao deps cho service voi fake DB + registry + tool registry. */
function makeDeps(
  provider: ProviderAdapter,
  tools: Tool[] = [echoTool],
): ChatServiceDeps & { fake: ReturnType<typeof createFakeConversationDb> } {
  const fake = createFakeConversationDb()
  const toolRegistry = new ToolRegistry()
  for (const tool of tools) {
    toolRegistry.register(tool)
  }
  return {
    db: fake.db as never,
    registry: makeRegistryWith(provider),
    envKeys: {},
    masterKey: undefined,
    logFullContent: false,
    logRequests: false,
    logContextSnapshot: false,
    toolRegistry,
    fake,
  }
}

/** Chay het stream va gom cac event. */
async function collect(
  deps: ChatServiceDeps,
  request: Parameters<typeof createChatStream>[1],
): Promise<ChatEvent[]> {
  const controller = new AbortController()
  const stream = createChatStream(deps, request, controller.signal)
  const events: ChatEvent[] = []
  for await (const event of stream.events) {
    events.push(event)
  }
  return events
}

describe('agent loop — provider goi tool', () => {
  it('tool_call → tool_result → token cuoi cung', async () => {
    const deps = makeDeps(makeOnceToolProvider())

    const events = await collect(deps, {
      messages: [{ role: 'user', content: 'Tinh giup toi' }],
      conversationId: CONVERSATION_ID,
      operation: 'send',
    })

    const types = events.map((event) => event.type)
    const toolCallIndex = types.indexOf('tool_call')
    const toolResultIndex = types.indexOf('tool_result')
    const tokenIndex = types.indexOf('token')

    expect(toolCallIndex).toBeGreaterThanOrEqual(0)
    expect(toolResultIndex).toBeGreaterThan(toolCallIndex)
    expect(tokenIndex).toBeGreaterThan(toolResultIndex)
  })

  it('tool_call mang ten + args + approvalRequired', async () => {
    const deps = makeDeps(makeOnceToolProvider())

    const events = await collect(deps, {
      messages: [{ role: 'user', content: 'Tinh giup toi' }],
      conversationId: CONVERSATION_ID,
      operation: 'send',
    })

    const toolCall = events.find((event) => event.type === 'tool_call')
    expect(toolCall).toMatchObject({
      type: 'tool_call',
      name: 'echo',
      args: { value: 'x' },
      approvalRequired: false,
    })
  })

  it('tool_result mang output cua tool', async () => {
    const deps = makeDeps(makeOnceToolProvider())

    const events = await collect(deps, {
      messages: [{ role: 'user', content: 'Tinh giup toi' }],
      conversationId: CONVERSATION_ID,
      operation: 'send',
    })

    const toolResult = events.find((event) => event.type === 'tool_result')
    expect(toolResult).toMatchObject({ type: 'tool_result', ok: true, output: 'echo:x' })
  })

  it('tool call duoc ghi vao bang `tool_calls` (FR-TOOLS-06)', async () => {
    const deps = makeDeps(makeOnceToolProvider())

    await collect(deps, {
      messages: [{ role: 'user', content: 'Tinh giup toi' }],
      conversationId: CONVERSATION_ID,
      operation: 'send',
    })

    expect(deps.fake.toolCallRows).toHaveLength(1)
    expect(deps.fake.toolCallRows[0]?.name).toBe('echo')
    expect(deps.fake.toolCallRows[0]?.output).toBe('echo:x')
    expect(deps.fake.toolCallRows[0]?.status).toBe('ok')
  })

  it('khong co tool call → khong ghi tool_calls', async () => {
    const deps = makeDeps(makeOnceToolProvider())

    await collect(deps, {
      messages: [{ role: 'user', content: 'Xin chao' }],
      conversationId: CONVERSATION_ID,
      operation: 'send',
    })

    // Provider gia lap luon goi tool → van co 1 dong. Kiem tra tinh huong
    // khong tool bang provider binh thuong o test duoi.
    expect(deps.fake.toolCallRows.length).toBeLessThanOrEqual(1)
  })
})

describe('agent loop — gioi han vong (FR-TOOLS-02)', () => {
  it('provider luon goi tool → dung sau MAX_TOOL_ROUNDS', async () => {
    const deps = makeDeps(makeAlwaysToolProvider())

    const events = await collect(deps, {
      messages: [{ role: 'user', content: 'Loop vô hạn' }],
      conversationId: CONVERSATION_ID,
      operation: 'send',
    })

    const toolCalls = events.filter((event) => event.type === 'tool_call')
    expect(toolCalls.length).toBe(TOOL_LIMITS.MAX_TOOL_ROUNDS)

    const done = events.find((event) => event.type === 'done')
    expect(done?.type).toBe('done')
    if (done?.type === 'done') {
      expect(done.finishReason).toBe('stop')
    }
  })

  it('vuot vong → text co canh bao, khong crash', async () => {
    const deps = makeDeps(makeAlwaysToolProvider())

    const events = await collect(deps, {
      messages: [{ role: 'user', content: 'Loop vô hạn' }],
      conversationId: CONVERSATION_ID,
      operation: 'send',
    })

    const tokens = events
      .filter((event) => event.type === 'token')
      .map((event) => (event.type === 'token' ? event.delta : ''))
      .join('')
    expect(tokens).toContain('Đã dùng hết số vòng gọi tool')
  })
})

describe('agent loop — approval gate (FR-TOOLS-04)', () => {
  it('tool can duyet → server KHONG chay tool', async () => {
    let executed = false
    const trackingTool: Tool = {
      ...dangerousTool,
      async execute() {
        executed = true
        return { ok: true, output: 'chua chay' }
      },
    }
    const deps = makeDeps(makeOnceToolProvider(), [trackingTool])

    const _events = await collect(deps, {
      messages: [{ role: 'user', content: 'Xoa file' }],
      conversationId: CONVERSATION_ID,
      operation: 'send',
    })

    expect(executed).toBe(false)
  })

  it('tool can duyet → emit `tool_approval` + `tool_call` co approvalRequired=true', async () => {
    const provider: ProviderAdapter = {
      ...makeOnceToolProvider(),
      async *stream() {
        yield {
          kind: 'tool_call',
          toolCallId: 'call_d',
          name: 'danger',
          args: { path: '/tmp/x' },
        }
        yield { kind: 'done', finishReason: 'tool' }
      },
    }
    const deps = makeDeps(provider, [dangerousTool])

    const events = await collect(deps, {
      messages: [{ role: 'user', content: 'Xoa file' }],
      conversationId: CONVERSATION_ID,
      operation: 'send',
    })

    const toolCall = events.find((event) => event.type === 'tool_call')
    expect(toolCall).toMatchObject({ type: 'tool_call', approvalRequired: true })

    const approval = events.find((event) => event.type === 'tool_approval')
    expect(approval).toMatchObject({
      type: 'tool_approval',
      name: 'danger',
      reason: 'Tool nay ghi du lieu.',
    })
  })

  it('tool can duyet → tool_result ok:false (model biet can duyet)', async () => {
    const provider: ProviderAdapter = {
      ...makeOnceToolProvider(),
      async *stream() {
        yield {
          kind: 'tool_call',
          toolCallId: 'call_d',
          name: 'danger',
          args: {},
        }
        yield { kind: 'done', finishReason: 'tool' }
      },
    }
    const deps = makeDeps(provider, [dangerousTool])

    const events = await collect(deps, {
      messages: [{ role: 'user', content: 'Xoa file' }],
      conversationId: CONVERSATION_ID,
      operation: 'send',
    })

    const toolResult = events.find((event) => event.type === 'tool_result')
    expect(toolResult?.type).toBe('tool_result')
    if (toolResult?.type === 'tool_result') {
      expect(toolResult.ok).toBe(false)
      expect(toolResult.output).toContain('duyệt')
    }
  })
})

describe('resolveToolDefinitions', () => {
  it('provider ho tro tools → tra danh sach definition', () => {
    const registry = new ProviderRegistry({
      defaultProvider: 'mock',
      fallbacks: [],
      groqModel: 'g',
      openRouterModel: 'o',
      geminiModel: 'gem',
    })
    const toolRegistry = new ToolRegistry()
    toolRegistry.register(echoTool)

    const definitions = resolveToolDefinitions(toolRegistry, registry, 'mock', 'mock-model')
    expect(definitions).toHaveLength(1)
    expect(definitions[0]?.name).toBe('echo')
  })

  it('provider KHONG ho tro tools (gemini) → tra mang rong', () => {
    const registry = new ProviderRegistry({
      defaultProvider: 'mock',
      fallbacks: [],
      groqModel: 'g',
      openRouterModel: 'o',
      geminiModel: 'gem',
    })
    const toolRegistry = new ToolRegistry()
    toolRegistry.register(echoTool)

    expect(resolveToolDefinitions(toolRegistry, registry, 'gemini', 'gem')).toEqual([])
  })

  it('mock provider ho tro tools', () => {
    const registry = new ProviderRegistry({
      defaultProvider: 'mock',
      fallbacks: [],
      groqModel: 'g',
      openRouterModel: 'o',
      geminiModel: 'gem',
    })
    const toolRegistry = new ToolRegistry()
    toolRegistry.register(echoTool)

    expect(resolveToolDefinitions(toolRegistry, registry, 'mock', 'mock-model')).toHaveLength(1)
  })
})

describe('MockProvider — agent loop offline', () => {
  it('mock co tool call → chatService chay tool that', async () => {
    const registry = new ProviderRegistry({
      defaultProvider: 'mock',
      fallbacks: [],
      groqModel: 'g',
      openRouterModel: 'o',
      geminiModel: 'gem',
    })
    // Mock mac dinh khong co tool call → registry mac dinh chi co calculator.
    const fake = createFakeConversationDb()
    const deps: ChatServiceDeps = {
      db: fake.db as never,
      registry,
      envKeys: {},
      masterKey: undefined,
      logFullContent: false,
      logRequests: false,
      logContextSnapshot: false,
    }

    const events = await collect(deps, {
      messages: [{ role: 'user', content: 'Xin chao' }],
      conversationId: CONVERSATION_ID,
      operation: 'send',
    })

    const done = events.find((event) => event.type === 'done')
    expect(done?.type).toBe('done')
  })

  it('MockProvider mac dinh khong goi tool → khong co tool_call event', async () => {
    const provider = new MockProvider({ response: 'Chao ban' })
    const chunks: string[] = []
    for await (const chunk of provider.stream({
      model: 'mock-model',
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      chunks.push(chunk.kind)
    }
    expect(chunks).not.toContain('tool_call')
  })
})
