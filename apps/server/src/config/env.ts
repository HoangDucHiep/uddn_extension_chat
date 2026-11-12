import { config } from 'dotenv'
import { z } from 'zod'

/**
 * Loader cho bien moi truong cua BFF.
 * Docs: docs/SYSTEM_DESIGN.md §6
 */

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  HOST: z.string().default('127.0.0.1'),

  DATABASE_URL: z.string().min(1),
  PGPASSWORD: z.string().optional(),

  /** 32 byte hex (64 ky tu) cho AES-256-GCM. Bat buoc khi can ma hoa BYOK key. */
  MASTER_KEY: z.string().regex(/^[0-9a-f]{64}$/i).optional(),

  /** Danh sach origin duoc phep goi BFF, phan tach bang dau phay. */
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),

  DEFAULT_PROVIDER: z.enum(['mock', 'groq', 'openrouter', 'gemini', 'ollama']).default('mock'),
  PROVIDER_FALLBACKS: z.string().default(''),

  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('google/gemini-2.5-flash'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.6-flash'),
  GEMINI_FALLBACK_MODELS: z.string().default('gemini-flash-lite-latest'),

  /** Base URL cua Ollama (API tuong thich OpenAI). FR-PROVIDER-07. */
  OLLAMA_BASE_URL: z.string().default('http://127.0.0.1:11434/v1'),
  /** Model mac dinh cua Ollama. */
  OLLAMA_MODEL: z.string().default('llama3.2'),

  /**
   * Ghi 1 dong `request_logs` cho moi luot chat (mac dinh **BAT**).
   *
   * Chi ghi **metadata** (provider · model · token · cost · ttft · latency ·
   * context_hash) → khong chua noi dung nguoi dung. Muon luu them prompt /
   * response day du → bat them `LOG_FULL_CONTENT`.
   */
  LOG_REQUESTS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  /**
   * Luu **prompt + response day du** vao `request_logs` (mac dinh TAT).
   *
   * NOI DUNG NHAY CAM — chi bat khi can truy viet chi tiet. Khong dung
   * cho muc dich tinh chi phi (chi can token).
   */
  LOG_FULL_CONTENT: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /**
   * So ngay giu lai `request_logs` (mac dinh 90 ngay — retention policy §5.2).
   *
   * `0` = giu vinh vien (khong dung cho production).
   */
  LOG_RETENTION_DAYS: z.coerce.number().int().min(0).default(90),
  /**
   * Luu snapshot context vao `request_logs.context_snapshot` (mac dinh TAT).
   *
   * Snapshot chua noi dung trang → du lieu nhay cam. `context_hash` luon duoc
   * ghi (khong chua noi dung).
   */
  LOG_CONTEXT_SNAPSHOT: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export type AppEnv = z.infer<typeof envSchema>

let cached: AppEnv | undefined

/**
 * Doc va validate env. Cache lai trong process de khong parse lai nhieu lan.
 * Nem loi khi env sai — fail fast som truoc khi mo server.
 */
export function loadEnv(): AppEnv {
  if (cached) return cached

  config({ path: process.env['DOTENV_PATH'] ?? '.env', quiet: true })

  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Cấu hình môi trường không hợp lệ:\n${issues}`)
  }

  cached = parsed.data
  return cached
}

/** Danh sach origin duoc phep (da chuan hoa, khong co dau phay thua). */
export function getAllowedOrigins(env: AppEnv): string[] {
  return env.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}

/** Chuoi fallback provider (theo thu tu uu tien). */
export function getProviderFallbacks(env: AppEnv): string[] {
  return env.PROVIDER_FALLBACKS.split(',')
    .map((provider) => provider.trim())
    .filter((provider) => provider.length > 0)
}

/** Danh sach model fallback cho Gemini. */
export function getGeminiFallbackModels(env: AppEnv): string[] {
  return env.GEMINI_FALLBACK_MODELS.split(',')
    .map((model) => model.trim())
    .filter((model) => model.length > 0)
}

/** Reset cache — chi dung cho test. */
export function resetEnvCache(): void {
  cached = undefined
}
