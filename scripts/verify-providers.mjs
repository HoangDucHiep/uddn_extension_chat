/**
 * Script verify 3 provider that — stream SSE qua BFF va kiem tra token den.
 *
 * Dung: node scripts/verify-providers.mjs
 * Key lay tu apps/server/.env (git-ignore). KHONG bao gio in key ra console.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

/** Doc .env cua BFF. */
function loadEnvFile(path) {
  try {
    const raw = readFileSync(path, 'utf8')
    const result = {}
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim()
      result[key] = value
    }
    return result
  } catch {
    return {}
  }
}

const env = loadEnvFile(join(ROOT, 'apps', 'server', '.env'))

const BASE_URL = process.env.SIDEKICK_BFF_URL ?? `http://127.0.0.1:${env.PORT ?? 8787}`

const PROVIDERS = [
  {
    id: 'groq',
    label: 'Groq',
    apiKey: env.GROQ_API_KEY,
    model: env.GROQ_MODEL ?? 'openai/gpt-oss-120b',
    envName: 'GROQ_API_KEY',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    apiKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash',
    envName: 'OPENROUTER_API_KEY',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL ?? 'gemini-3.6-flash',
    envName: 'GEMINI_API_KEY',
  },
]

const PROMPT = 'Tra loi bang mot cau ngan: ban la tro ly gi?'

/** Stream SSE va tra ve ket qua. */
async function streamChat(providerId, model) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000)

  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: PROMPT }],
        provider: providerId,
        model,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text()
      return { ok: false, reason: `HTTP ${response.status}: ${text.slice(0, 200)}` }
    }

    const events = await readSse(response.body)
    const tokens = events.filter((event) => event.type === 'token')
    const done = events.find((event) => event.type === 'done')
    const error = events.find((event) => event.type === 'error')
    const meta = events.find((event) => event.type === 'meta')

    if (error) {
      return { ok: false, reason: `error event: ${error.code} — ${error.message}` }
    }
    if (!done) {
      return { ok: false, reason: 'khong nhan duoc event "done"' }
    }
    if (tokens.length === 0) {
      return { ok: false, reason: 'khong nhan duoc token nao' }
    }

    const text = tokens.map((token) => token.delta).join('')
    return {
      ok: true,
      tokenCount: tokens.length,
      text,
      finishReason: done.finishReason,
      model: meta?.model ?? model,
      keySource: meta?.keySource ?? '?',
    }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  } finally {
    clearTimeout(timeout)
  }
}

/** Doc stream SSE thanh cac event da parse JSON. */
async function readSse(body) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const events = []

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

    let index = buffer.indexOf('\n\n')
    while (index !== -1) {
      const raw = buffer.slice(0, index)
      buffer = buffer.slice(index + 2)
      const dataLine = raw.split(/\r?\n/).find((line) => line.startsWith('data:'))
      if (dataLine) {
        const payload = dataLine.slice(5).trim()
        try {
          events.push(JSON.parse(payload))
        } catch {
          // Bo qua payload khong phai JSON.
        }
      }
      index = buffer.indexOf('\n\n')
    }
  }

  return events
}

async function main() {
  console.log(`BFF: ${BASE_URL}`)
  console.log('')

  const results = []
  for (const provider of PROVIDERS) {
    if (!provider.apiKey) {
      console.log(`[SKIP] ${provider.label} — thieu ${provider.envName} trong apps/server/.env`)
      results.push({ id: provider.id, ok: false, reason: 'thieu key' })
      continue
    }

    const startedAt = Date.now()
    const result = await streamChat(provider.id, provider.model)
    const durationMs = Date.now() - startedAt

    if (result.ok) {
      console.log(
        `[OK] ${provider.label.padEnd(11)} ${String(result.tokenCount).padStart(3)} token | ` +
          `${String(durationMs).padStart(5)}ms | model=${result.model} | key=${result.keySource}`,
      )
      console.log(`     ${result.text.slice(0, 120).replace(/\n/g, ' ')}`)
      results.push({ id: provider.id, ok: true, durationMs, tokenCount: result.tokenCount })
    } else {
      console.log(`[FAIL] ${provider.label.padEnd(11)} ${result.reason}`)
      results.push({ id: provider.id, ok: false, reason: result.reason })
    }
  }

  const passed = results.filter((result) => result.ok).length
  console.log('')
  console.log(`Ket qua: ${passed}/${results.length} provider stream thanh cong.`)

  if (passed < results.length) {
    process.exit(1)
  }
}

await main()
