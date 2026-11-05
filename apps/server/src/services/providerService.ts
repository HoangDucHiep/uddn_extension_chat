/**
 * Provider service — quan ly danh sach provider + BYOK key (K2).
 *
 * Trach nhiem:
 *  - `listProviderInfo()` — metadata provider cho onboarding (khong goi network
 *    tru khi probe Ollama) · keySource K2 > K1 > none
 *  - `saveProviderKey()` — ma hoa AES-256-GCM roi luu vao `provider_keys`
 *  - `listProviderKeys()` — **chi** metadata + key da che (khong bao gio key goc)
 *  - `deleteProviderKey()` — xoa key
 *  - `testProviderKey()` — goi provider that de kiem tra key co hoat dong
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §6.1
 */

import { randomUUID } from 'node:crypto'
import {
  AppError,
  ERROR_CODES,
  PROVIDER_IDS,
  type ProviderId,
  type ProviderInfo,
  type ProviderKeyRecord,
  type ProviderKeyTestResult,
} from '@sidekick/shared'
import { and, desc, eq } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { providerKeys } from '../db/schema.js'
import { decrypt, encrypt, keyHint } from '../lib/crypto.js'
import { detectOllama, OLLAMA_DEFAULT_BASE_URL } from '../providers/ollama.js'
import type { ProviderRegistry } from '../providers/registry.js'
import { maskKey, type EnvKeys } from '../providers/keyResolver.js'

export interface ProviderServiceDeps {
  db: Database
  registry: ProviderRegistry
  envKeys: EnvKeys
  masterKey: string | undefined
  /** Base URL goc cua Ollama (khong co `/v1`) — dung de probe. */
  ollamaBaseUrl?: string
}

/** Nhan ten hien thi cua provider. */
const PROVIDER_NAMES: Record<ProviderId, string> = {
  mock: 'Mock Provider',
  groq: 'Groq',
  openrouter: 'OpenRouter',
  gemini: 'Gemini',
  ollama: 'Ollama',
}

/** Label mac dinh khi luu key (unique constraint `(provider_id, label)`). */
const DEFAULT_KEY_LABEL = 'default'

/**
 * Lay danh sach provider + trang thai key.
 *
 * Thu tu uu tien nguon key: **K2 (DB)** > **K1 (env)** > `none`.
 * Provider khong can key (mock, ollama) → `keySource: 'none'`.
 *
 * @param deps - Dependency cua service.
 * @param options - `probeOllama`: co probe Ollama local hay khong (mac dinh true).
 */
export async function listProviderInfo(
  deps: ProviderServiceDeps,
  options: { probeOllama?: boolean } = {},
): Promise<ProviderInfo[]> {
  const probeOllama = options.probeOllama ?? true

  // Key K2 theo provider — truy van 1 lan cho tat ca provider.
  const dbKeyProviders = await listProvidersWithDbKey(deps.db)

  const infos: ProviderInfo[] = []

  for (const providerId of PROVIDER_IDS) {
    const adapter = deps.registry.get(providerId)
    if (!adapter) continue

    const requiresKey = adapter.requiresKey
    const hasDbKey = dbKeyProviders.has(providerId)
    const hasEnvKey = hasEnvKeyFor(deps.envKeys, providerId)

    let keySource: ProviderInfo['keySource'] = 'none'
    if (requiresKey) {
      if (hasDbKey) keySource = 'K2'
      else if (hasEnvKey) keySource = 'K1'
    }

    let available = requiresKey ? hasDbKey || hasEnvKey : providerId === 'mock'
    let note: string | undefined

    // Ollama local: phai probe de biet co chay hay khong.
    if (providerId === 'ollama') {
      if (probeOllama) {
        const detection = await detectOllama(deps.ollamaBaseUrl ?? OLLAMA_DEFAULT_BASE_URL)
        available = detection.available
        note = detection.available
          ? undefined
          : `Ollama chua chay. Hay bat Ollama tai ${deps.ollamaBaseUrl ?? OLLAMA_DEFAULT_BASE_URL}.`
      } else {
        available = true
      }
    }

    infos.push({
      id: providerId,
      name: PROVIDER_NAMES[providerId],
      models: [deps.registry.getDefaultModel(providerId)].filter((model) => model.length > 0),
      keySource,
      requiresKey,
      available,
      ...(note !== undefined ? { note } : {}),
    })
  }

  return infos
}

/** Danh sach provider co key K2 active trong DB. */
async function listProvidersWithDbKey(db: Database): Promise<Set<ProviderId>> {
  const rows = await db
    .select({ providerId: providerKeys.providerId })
    .from(providerKeys)
    .where(eq(providerKeys.isActive, true))

  const result = new Set<ProviderId>()
  for (const row of rows) {
    if ((PROVIDER_IDS as readonly string[]).includes(row.providerId)) {
      result.add(row.providerId as ProviderId)
    }
  }
  return result
}

/** Provider co key K1 (env) hay khong. */
function hasEnvKeyFor(envKeys: EnvKeys, providerId: ProviderId): boolean {
  const map: Record<ProviderId, keyof EnvKeys | undefined> = {
    mock: undefined,
    groq: 'groq',
    openrouter: 'openrouter',
    gemini: 'gemini',
    ollama: undefined,
  }
  const envName = map[providerId]
  if (!envName) return false
  const value = envKeys[envName]
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Luu API key (K2) — ma hoa AES-256-GCM truoc khi luu.
 *
 * Upsert theo `(provider_id, label)` → luu lai cung provider + label se
 * ghi de ban ghi cu, khong nhan ban trung.
 *
 * @param deps - Dependency cua service.
 * @param input - `{ providerId, apiKey, label? }` (da validate o bien).
 */
export async function saveProviderKey(
  deps: ProviderServiceDeps,
  input: { providerId: ProviderId; apiKey: string; label?: string | undefined },
): Promise<ProviderKeyRecord> {
  if (!deps.masterKey) {
    throw new AppError(
      ERROR_CODES.MASTER_KEY_NOT_CONFIGURED,
      'BFF chua co MASTER_KEY → khong luu duoc API key. Hay dat MASTER_KEY trong file .env.',
    )
  }

  const label = input.label?.trim() || DEFAULT_KEY_LABEL
  const payload = encrypt(input.apiKey, deps.masterKey)
  const masked = maskKey(input.apiKey)

  const rows = await deps.db
    .insert(providerKeys)
    .values({
      providerId: input.providerId,
      label,
      ciphertext: payload.ciphertext,
      iv: payload.iv,
      authTag: payload.authTag,
      hint: keyHint(input.apiKey),
    })
    .onConflictDoUpdate({
      target: [providerKeys.providerId, providerKeys.label],
      set: {
        ciphertext: payload.ciphertext,
        iv: payload.iv,
        authTag: payload.authTag,
        hint: keyHint(input.apiKey),
        isActive: true,
      },
    })
    .returning()

  const row = rows[0]
  if (!row) {
    throw new AppError(ERROR_CODES.DB_ERROR, 'Khong luu duoc API key')
  }

  return {
    id: row.id,
    providerId: input.providerId,
    label: row.label,
    masked,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Danh sach key da luu — **chi** metadata + key da che.
 *
 * Khong bao gio tra key goc (FR-PROVIDER-02).
 */
export async function listProviderKeys(deps: ProviderServiceDeps): Promise<ProviderKeyRecord[]> {
  const rows = await deps.db
    .select()
    .from(providerKeys)
    .where(eq(providerKeys.isActive, true))
    .orderBy(desc(providerKeys.createdAt))

  return rows.map((row) => ({
    id: row.id,
    providerId: row.providerId as ProviderId,
    label: row.label,
    masked: `****${row.hint}`,
    createdAt: row.createdAt.toISOString(),
  }))
}

/**
 * Xoa API key.
 *
 * @param deps - Dependency cua service.
 * @param id - Id cua ban ghi can xoa.
 */
export async function deleteProviderKey(deps: ProviderServiceDeps, id: string): Promise<void> {
  const deleted = await deps.db
    .delete(providerKeys)
    .where(eq(providerKeys.id, id))
    .returning({ id: providerKeys.id })

  if (deleted.length === 0) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Khong tim thay API key')
  }
}

/**
 * Kiem tra API key co hoat dong khong — goi provider that.
 *
 * Khong luu key moi vao DB: dung key vua luu trong DB.
 *
 * @param deps - Dependency cua service.
 * @param id - Id cua ban ghi key.
 */
export async function testProviderKey(
  deps: ProviderServiceDeps,
  id: string,
): Promise<ProviderKeyTestResult> {
  const rows = await deps.db.select().from(providerKeys).where(eq(providerKeys.id, id)).limit(1)
  const row = rows[0]
  if (!row) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Khong tim thay API key')
  }

  if (!deps.masterKey) {
    throw new AppError(
      ERROR_CODES.MASTER_KEY_NOT_CONFIGURED,
      'BFF chua co MASTER_KEY → khong giai ma duoc API key da luu.',
    )
  }

  const providerId = row.providerId as ProviderId
  const adapter = deps.registry.get(providerId)
  if (!adapter) {
    throw new AppError(ERROR_CODES.NOT_FOUND, `Khong tim thay provider "${providerId}"`)
  }

  let apiKey: string
  try {
    apiKey = decrypt(
      { ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag },
      deps.masterKey,
    )
  } catch {
    throw new AppError(
      ERROR_CODES.INVALID_API_KEY,
      'Khong giai ma duoc key da luu. MASTER_KEY co the da thay doi.',
    )
  }

  const startedAt = Date.now()
  try {
    // Provider tu kiem tra key (goi API that) → `ok` phan ánh key that su co dung.
    const check = await adapter.testKey(apiKey)
    const latencyMs = Date.now() - startedAt
    if (check.ok) {
      return { ok: true, latencyMs }
    }
    return {
      ok: false,
      latencyMs,
      error: check.error ?? 'Key khong hop le',
    }
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    return {
      ok: false,
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    // `apiKey` chi dung trong ham nay → xoa de khong giu lai trong bo nho.
    void apiKey
  }
}

/** Id moi cho ban ghi key (dung khi can tao truoc khi insert). */
export function newProviderKeyId(): string {
  return randomUUID()
}

/** Filter provider co key active theo provider + label (dung cho upsert). */
export function keyIdentityFilter(providerId: ProviderId, label: string) {
  return and(eq(providerKeys.providerId, providerId), eq(providerKeys.label, label))
}
