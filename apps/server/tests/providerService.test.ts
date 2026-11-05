import { describe, expect, it, vi, afterEach } from 'vitest'
import { AppError, ERROR_CODES } from '@sidekick/shared'
import { ProviderRegistry } from '../src/providers/registry.js'
import { decrypt } from '../src/lib/crypto.js'
import {
  deleteProviderKey,
  listProviderInfo,
  listProviderKeys,
  saveProviderKey,
  testProviderKey,
  type ProviderServiceDeps,
} from '../src/services/providerService.js'
import { createFakeProviderKeyDb } from './helpers/fakeProviderKeyDb.js'

/**
 * Unit test cho provider service — BYOK key (K2) + danh sach provider.
 *
 * FR-PROVIDER-02 (key ma hoa) · FR-UX-02 (onboarding buoc 2 — T-M1-25)
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §6.1
 */

const MASTER_KEY = 'a'.repeat(64)

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Tao registry that voi provider mac dinh mock. */
function makeRegistry(): ProviderRegistry {
  return new ProviderRegistry({
    defaultProvider: 'mock',
    fallbacks: [],
    groqModel: 'openai/gpt-oss-120b',
    openRouterModel: 'google/gemini-2.5-flash',
    geminiModel: 'gemini-3.6-flash',
  })
}

/** Tao deps cho service voi fake DB. */
function makeDeps(
  overrides: Partial<ProviderServiceDeps> = {},
): ProviderServiceDeps & { fake: ReturnType<typeof createFakeProviderKeyDb> } {
  const fake = createFakeProviderKeyDb()
  return {
    db: fake.db as never,
    registry: makeRegistry(),
    envKeys: {},
    masterKey: MASTER_KEY,
    fake,
    ...overrides,
  }
}

describe('saveProviderKey', () => {
  it('ma hoa key truoc khi luu (khong luu plaintext)', async () => {
    const deps = makeDeps()

    await saveProviderKey(deps, { providerId: 'groq', apiKey: 'gsk_secret_value_1234' })

    const stored = deps.fake.rows[0]
    expect(stored).toBeDefined()
    expect(stored?.ciphertext).not.toContain('gsk_secret_value_1234')
    expect(stored?.ciphertext.length).toBeGreaterThan(0)
  })

  it('encrypt → decrypt round-trip giu nguyen key goc', async () => {
    const deps = makeDeps()
    const apiKey = 'gsk_secret_value_1234'

    await saveProviderKey(deps, { providerId: 'groq', apiKey })

    const stored = deps.fake.rows[0]
    const plaintext = decrypt(
      { ciphertext: stored?.ciphertext ?? '', iv: stored?.iv ?? '', authTag: stored?.authTag ?? '' },
      MASTER_KEY,
    )
    expect(plaintext).toBe(apiKey)
  })

  it('masked chi lo 4 ky tu cuoi', async () => {
    const deps = makeDeps()

    const record = await saveProviderKey(deps, { providerId: 'groq', apiKey: 'gsk_secret_value_1234' })

    expect(record.masked).toBe('****1234')
    expect(record.masked).not.toContain('gsk_secret')
  })

  it('upsert khong tao ban ghi trung (cung provider + label)', async () => {
    const deps = makeDeps()

    await saveProviderKey(deps, { providerId: 'groq', apiKey: 'gsk_dau_tien_1234' })
    await saveProviderKey(deps, { providerId: 'groq', apiKey: 'gsk_thu_hai_5678' })

    expect(deps.fake.rows).toHaveLength(1)
    expect(deps.fake.rows[0]?.hint).toBe('5678')
  })

  it('label khac → tao ban ghi rieng', async () => {
    const deps = makeDeps()

    await saveProviderKey(deps, { providerId: 'groq', apiKey: 'gsk_dau_tien_1234' })
    await saveProviderKey(deps, { providerId: 'groq', apiKey: 'gsk_thu_hai_5678', label: 'backup' })

    expect(deps.fake.rows).toHaveLength(2)
  })

  it('nem MASTER_KEY_NOT_CONFIGURED khi thieu MASTER_KEY', async () => {
    const deps = makeDeps({ masterKey: undefined })

    await expect(
      saveProviderKey(deps, { providerId: 'groq', apiKey: 'gsk_secret_value_1234' }),
    ).rejects.toMatchObject({ code: ERROR_CODES.MASTER_KEY_NOT_CONFIGURED })
  })

  it('response khong chua key goc', async () => {
    const deps = makeDeps()

    const record = await saveProviderKey(deps, { providerId: 'groq', apiKey: 'gsk_secret_value_1234' })

    expect(JSON.stringify(record)).not.toContain('gsk_secret_value_1234')
  })
})

describe('listProviderKeys', () => {
  it('chi tra metadata + key da che', async () => {
    const deps = makeDeps()
    await saveProviderKey(deps, { providerId: 'groq', apiKey: 'gsk_secret_value_1234' })

    const items = await listProviderKeys(deps)

    expect(items).toHaveLength(1)
    expect(items[0]?.masked).toBe('****1234')
    expect(JSON.stringify(items)).not.toContain('gsk_secret_value_1234')
  })
})

describe('deleteProviderKey', () => {
  it('xoa ban ghi theo id', async () => {
    const deps = makeDeps()
    const record = await saveProviderKey(deps, { providerId: 'groq', apiKey: 'gsk_secret_value_1234' })

    await deleteProviderKey(deps, record.id)

    expect(deps.fake.rows).toHaveLength(0)
  })

  it('nem NOT_FOUND khi id khong ton tai', async () => {
    const deps = makeDeps()

    await expect(deleteProviderKey(deps, 'khong-ton-tai')).rejects.toMatchObject({
      code: ERROR_CODES.NOT_FOUND,
    })
  })
})

describe('testProviderKey', () => {
  it('tra ok = true khi provider chap nhan key', async () => {
    const deps = makeDeps()
    const record = await saveProviderKey(deps, { providerId: 'mock', apiKey: 'bat-ky-1234' })

    const result = await testProviderKey(deps, record.id)

    expect(result.ok).toBe(true)
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('tra ok = false kem error khi provider tu choi key', async () => {
    const deps = makeDeps()
    const record = await saveProviderKey(deps, { providerId: 'groq', apiKey: 'gsk_sai_key_1234' })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      })),
    )

    const result = await testProviderKey(deps, record.id)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('401')
  })

  it('nem NOT_FOUND khi id khong ton tai', async () => {
    const deps = makeDeps()

    await expect(testProviderKey(deps, 'khong-ton-tai')).rejects.toMatchObject({
      code: ERROR_CODES.NOT_FOUND,
    })
  })

  it('nem MASTER_KEY_NOT_CONFIGURED khi thieu MASTER_KEY', async () => {
    const deps = makeDeps({ masterKey: undefined })
    const record = await saveProviderKey(
      { ...deps, masterKey: MASTER_KEY },
      { providerId: 'groq', apiKey: 'gsk_secret_value_1234' },
    )
    const depsNoKey = { ...deps, masterKey: undefined }

    await expect(testProviderKey(depsNoKey, record.id)).rejects.toMatchObject({
      code: ERROR_CODES.MASTER_KEY_NOT_CONFIGURED,
    })
  })
})

describe('listProviderInfo', () => {
  it('keySource = none cho provider khong can key', async () => {
    const deps = makeDeps()

    const items = await listProviderInfo(deps, { probeOllama: false })

    const mock = items.find((item) => item.id === 'mock')
    expect(mock?.keySource).toBe('none')
    expect(mock?.requiresKey).toBe(false)
  })

  it('keySource = K1 khi chi co env key', async () => {
    const deps = makeDeps({ envKeys: { groq: 'gsk_env_key_1234' } })

    const items = await listProviderInfo(deps, { probeOllama: false })

    const groq = items.find((item) => item.id === 'groq')
    expect(groq?.keySource).toBe('K1')
    expect(groq?.available).toBe(true)
  })

  it('keySource = K2 uu tien K1 khi co key trong DB', async () => {
    const deps = makeDeps({ envKeys: { groq: 'gsk_env_key_1234' } })
    await saveProviderKey(deps, { providerId: 'groq', apiKey: 'gsk_db_key_5678' })

    const items = await listProviderInfo(deps, { probeOllama: false })

    const groq = items.find((item) => item.id === 'groq')
    expect(groq?.keySource).toBe('K2')
    expect(groq?.available).toBe(true)
  })

  it('keySource = none + available = false khi provider can key nhung khong co key', async () => {
    const deps = makeDeps()

    const items = await listProviderInfo(deps, { probeOllama: false })

    const groq = items.find((item) => item.id === 'groq')
    expect(groq?.requiresKey).toBe(true)
    expect(groq?.available).toBe(false)
    expect(groq?.keySource).toBe('none')
  })

  it('ollama co note khi khong phat hien duoc', async () => {
    const deps = makeDeps()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED')
      }),
    )

    const items = await listProviderInfo(deps, { probeOllama: true })

    const ollama = items.find((item) => item.id === 'ollama')
    expect(ollama?.available).toBe(false)
    expect(ollama?.note).toContain('Ollama')
  })

  it('ollama available = true khi phat hien duoc', async () => {
    const deps = makeDeps()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ models: [{ name: 'llama3.2:latest' }] }),
      })),
    )

    const items = await listProviderInfo(deps, { probeOllama: true })

    const ollama = items.find((item) => item.id === 'ollama')
    expect(ollama?.available).toBe(true)
    expect(ollama?.keySource).toBe('none')
  })

  it('model lay tu registry, khong goi network', async () => {
    const deps = makeDeps()

    const items = await listProviderInfo(deps, { probeOllama: false })

    const groq = items.find((item) => item.id === 'groq')
    expect(groq?.models).toEqual(['openai/gpt-oss-120b'])
  })
})

describe('AppError', () => {
  it('AppError co status/code chuan', () => {
    const error = new AppError(ERROR_CODES.PROVIDER_KEY_INVALID, 'Key sai')
    expect(error.status).toBe(400)
    expect(error.code).toBe(ERROR_CODES.PROVIDER_KEY_INVALID)
  })
})
