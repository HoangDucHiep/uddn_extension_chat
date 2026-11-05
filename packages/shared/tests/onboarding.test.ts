import { describe, expect, it } from 'vitest'
import { API_ROUTES, ONBOARDING_STEPS } from '../src/constants.js'
import { ERROR_CODES, ERROR_STATUS_MAP } from '../src/errors.js'
import {
  providerKeyListResponseSchema,
  providerKeyRecordSchema,
  providerKeyTestResultSchema,
  providersResponseSchema,
  saveProviderKeyResponseSchema,
} from '../src/schemas/provider.js'
import { providerInfoSchema } from '../src/types/entities.js'

/**
 * Test contract onboarding + provider API (FR-UX-02 — T-M1-25).
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.6
 */

describe('providerInfoSchema', () => {
  it('accept keySource "none" (provider khong can key)', () => {
    const parsed = providerInfoSchema.safeParse({
      id: 'ollama',
      name: 'Ollama',
      models: ['llama3.2'],
      keySource: 'none',
      requiresKey: false,
      available: true,
    })
    expect(parsed.success).toBe(true)
  })

  it('accept keySource K1/K2/K3', () => {
    for (const keySource of ['K1', 'K2', 'K3'] as const) {
      const parsed = providerInfoSchema.safeParse({
        id: 'groq',
        name: 'Groq',
        models: ['openai/gpt-oss-120b'],
        keySource,
        requiresKey: true,
        available: true,
      })
      expect(parsed.success).toBe(true)
    }
  })

  it('reject keySource la', () => {
    const parsed = providerInfoSchema.safeParse({
      id: 'groq',
      name: 'Groq',
      models: [],
      keySource: 'K9',
      requiresKey: true,
      available: true,
    })
    expect(parsed.success).toBe(false)
  })

  it('accept note tuy chon (huong dan khi provider chua dung duoc)', () => {
    const parsed = providerInfoSchema.safeParse({
      id: 'ollama',
      name: 'Ollama',
      models: [],
      keySource: 'none',
      requiresKey: false,
      available: false,
      note: 'Ollama chua chay tai localhost:11434',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.note).toBe('Ollama chua chay tai localhost:11434')
    }
  })

  it('reject note qua dai', () => {
    const parsed = providerInfoSchema.safeParse({
      id: 'ollama',
      name: 'Ollama',
      models: [],
      keySource: 'none',
      requiresKey: false,
      available: false,
      note: 'x'.repeat(201),
    })
    expect(parsed.success).toBe(false)
  })
})

describe('providerKeyRecordSchema', () => {
  const record = {
    id: '11111111-2222-4333-8444-555555555555',
    providerId: 'groq',
    label: 'default',
    masked: '****abcd',
    createdAt: '2026-11-05T00:00:00.000Z',
  }

  it('accept metadata co masked', () => {
    const parsed = providerKeyRecordSchema.safeParse(record)
    expect(parsed.success).toBe(true)
  })

  it('reject id khong phai uuid', () => {
    const parsed = providerKeyRecordSchema.safeParse({ ...record, id: 'khong-phai-uuid' })
    expect(parsed.success).toBe(false)
  })

  it('reject providerId la', () => {
    const parsed = providerKeyRecordSchema.safeParse({ ...record, providerId: 'anthropic' })
    expect(parsed.success).toBe(false)
  })

  it('khong cho phep truong chua key goc', () => {
    const parsed = providerKeyRecordSchema.safeParse({ ...record, apiKey: 'gsk_secret' })
    // Zod object mac dinh bo qua key la → parse van OK nhung key bi strip.
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect('apiKey' in parsed.data).toBe(false)
    }
  })
})

describe('providerKeyTestResultSchema', () => {
  it('accept ket qua thanh cong', () => {
    const parsed = providerKeyTestResultSchema.safeParse({ ok: true, latencyMs: 123 })
    expect(parsed.success).toBe(true)
  })

  it('accept ket qua that bai kem error', () => {
    const parsed = providerKeyTestResultSchema.safeParse({
      ok: false,
      latencyMs: 10,
      error: '401 Unauthorized',
    })
    expect(parsed.success).toBe(true)
  })

  it('reject latencyMs am', () => {
    const parsed = providerKeyTestResultSchema.safeParse({ ok: true, latencyMs: -1 })
    expect(parsed.success).toBe(false)
  })
})

describe('providersResponseSchema', () => {
  it('parse danh sach provider', () => {
    const parsed = providersResponseSchema.safeParse({
      items: [
        {
          id: 'mock',
          name: 'Mock Provider',
          models: ['mock-model'],
          keySource: 'none',
          requiresKey: false,
          available: true,
        },
      ],
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.items).toHaveLength(1)
      expect(parsed.data.items[0]?.id).toBe('mock')
    }
  })

  it('reject danh sach rong (phai co items)', () => {
    const parsed = providersResponseSchema.safeParse({ items: 'khong-phai-mang' })
    expect(parsed.success).toBe(false)
  })
})

describe('providerKeyListResponseSchema', () => {
  it('parse danh sach key', () => {
    const parsed = providerKeyListResponseSchema.safeParse({
      items: [
        {
          id: '11111111-2222-4333-8444-555555555555',
          providerId: 'groq',
          label: 'default',
          masked: '****abcd',
          createdAt: '2026-11-05T00:00:00.000Z',
        },
      ],
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.items[0]?.masked).toBe('****abcd')
    }
  })
})

describe('saveProviderKeyResponseSchema', () => {
  it('accept response co masked', () => {
    const parsed = saveProviderKeyResponseSchema.safeParse({
      id: '11111111-2222-4333-8444-555555555555',
      providerId: 'groq',
      label: 'default',
      masked: '****abcd',
      createdAt: '2026-11-05T00:00:00.000Z',
    })
    expect(parsed.success).toBe(true)
  })
})

describe('ONBOARDING_STEPS', () => {
  it('co dung 3 buoc theo thu tu', () => {
    expect(ONBOARDING_STEPS).toEqual(['permissions', 'provider', 'try'])
  })
})

describe('API_ROUTES.providerKeys', () => {
  it('tro den /api/providers/keys', () => {
    expect(API_ROUTES.providerKeys).toBe('/api/providers/keys')
  })
})

describe('error code moi', () => {
  it('PROVIDER_KEY_INVALID → 400', () => {
    expect(ERROR_CODES.PROVIDER_KEY_INVALID).toBe('PROVIDER_KEY_INVALID')
    expect(ERROR_STATUS_MAP[ERROR_CODES.PROVIDER_KEY_INVALID]).toBe(400)
  })

  it('MASTER_KEY_NOT_CONFIGURED → 500', () => {
    expect(ERROR_CODES.MASTER_KEY_NOT_CONFIGURED).toBe('MASTER_KEY_NOT_CONFIGURED')
    expect(ERROR_STATUS_MAP[ERROR_CODES.MASTER_KEY_NOT_CONFIGURED]).toBe(500)
  })
})
