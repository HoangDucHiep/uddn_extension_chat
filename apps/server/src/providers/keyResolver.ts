/**
 * Key resolver — tra loi "provider nao lay key tu dau".
 *
 * K1: team key trong `.env` cua BFF (M0 mac dinh).
 * K2: BYOK ma hoa trong Postgres (AES-256-GCM).
 * K3: BYOK gui thang tu client (fallback khi BFF down — client tu goi provider).
 *
 * Docs: docs/SYSTEM_DESIGN.md §6.1, AGENTS.md §3.
 */

import { ERROR_CODES, type ProviderId, type ResolvedKey } from '@sidekick/shared'
import { and, desc, eq } from 'drizzle-orm'
import { AppError } from '@sidekick/shared'
import type { Database } from '../db/index.js'
import { providerKeys } from '../db/schema.js'
import { decrypt, keyHint } from '../lib/crypto.js'

export interface EnvKeys {
  groq?: string | undefined
  openrouter?: string | undefined
  gemini?: string | undefined
}

export interface KeyResolverDeps {
  db: Database
  envKeys: EnvKeys
  masterKey: string | undefined
}

/** Map provider id -> ten bien env chua key K1. */
const ENV_KEY_BY_PROVIDER: Record<ProviderId, keyof EnvKeys | undefined> = {
  mock: undefined,
  groq: 'groq',
  openrouter: 'openrouter',
  gemini: 'gemini',
  ollama: undefined,
}

/**
 * Resolve API key cho provider.
 * Thu tu: K2 (DB) -> K1 (env) -> loi MISSING_API_KEY.
 *
 * K2 duoc thu truoc vi day la key user chon chu dong (BYOK).
 */
export async function resolveKey(
  deps: KeyResolverDeps,
  providerId: ProviderId,
): Promise<ResolvedKey> {
  const fromDb = await resolveFromDb(deps, providerId)
  if (fromDb) return fromDb

  const fromEnv = resolveFromEnv(deps.envKeys, providerId)
  if (fromEnv) return fromEnv

  throw new AppError(
    ERROR_CODES.MISSING_API_KEY,
    `Khong tim thay API key cho provider "${providerId}". Hay cau hinh key trong settings hoac .env.`,
    { providerId },
  )
}

/** Resolve tu Postgres (K2). */
async function resolveFromDb(
  deps: KeyResolverDeps,
  providerId: ProviderId,
): Promise<ResolvedKey | undefined> {
  if (!deps.masterKey) return undefined

  const rows = await deps.db
    .select()
    .from(providerKeys)
    .where(and(eq(providerKeys.providerId, providerId), eq(providerKeys.isActive, true)))
    .orderBy(desc(providerKeys.lastUsedAt), desc(providerKeys.createdAt))
    .limit(1)

  const row = rows[0]
  if (!row) return undefined

  try {
    const apiKey = decrypt(
      { ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag },
      deps.masterKey,
    )
    return { apiKey, source: 'K2', providerId, keyId: row.id }
  } catch {
    // MASTER_KEY doi -> key cu khong decrypt duoc.
    throw new AppError(
      ERROR_CODES.INVALID_API_KEY,
      `Khong giai ma duoc key da luu cho provider "${providerId}". MASTER_KEY co the da thay doi.`,
      { providerId },
    )
  }
}

/** Resolve tu bien moi truong (K1). */
export function resolveFromEnv(envKeys: EnvKeys, providerId: ProviderId): ResolvedKey | undefined {
  const envName = ENV_KEY_BY_PROVIDER[providerId]
  if (!envName) return undefined

  const value = envKeys[envName]
  if (!value || value.trim().length === 0) return undefined

  return { apiKey: value, source: 'K1', providerId }
}

/** Danh sach provider nao hien co key de hien thi trong settings. */
export function listAvailableProviders(envKeys: EnvKeys): ProviderId[] {
  const providers: ProviderId[] = ['mock']
  for (const providerId of ['groq', 'openrouter', 'gemini'] as const) {
    const envName = ENV_KEY_BY_PROVIDER[providerId]
    if (envName && envKeys[envName]) providers.push(providerId)
  }
  return providers
}

/** Mask key khi hien thi cho user: `gsk_...****2345`. */
export function maskKey(apiKey: string): string {
  const hint = keyHint(apiKey)
  return `****${hint}`
}
