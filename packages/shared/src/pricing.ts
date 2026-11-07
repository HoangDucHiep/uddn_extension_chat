/**
 * Bang gia token cua provider — dung de tinh `cost_usd` cho moi luot chat.
 *
 * Gia tinh theo **USD / 1M token** (don vi chuan cua OpenAI/Gemini docs).
 * Bang gia thay doi theo thoi gian → snapshot gia se duoc ghi vao
 * `docs/EVAL_REPORT.md` khi do eval (xem `docs/EVAL_PLAN.md` §5.3).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.16 (T-M1-14)
 */

/** Gia 1 model: USD cho 1M token input / 1M token output. */
export interface ModelPricing {
  /** USD cho 1M token input (prompt). */
  inputPerMillion: number
  /** USD cho 1M token output (completion). */
  outputPerMillion: number
}

/** Gia theo provider: model cua rieng + gia mac dinh khi model la. */
export interface ProviderPricing {
  /** Gia mac dinh — dung khi model khong nam trong `models`. */
  default: ModelPricing
  /** Gia rieng cho tung model (key = ten model chinh xac). */
  models?: Record<string, ModelPricing>
}

/**
 * Bang gia theo provider.
 *
 * `mock` va `ollama` la **free** (local / test) → gia 0.
 */
export const PROVIDER_PRICING: Record<string, ProviderPricing> = {
  mock: {
    default: { inputPerMillion: 0, outputPerMillion: 0 },
  },
  ollama: {
    default: { inputPerMillion: 0, outputPerMillion: 0 },
  },
  groq: {
    default: { inputPerMillion: 0.05, outputPerMillion: 0.08 },
    models: {
      'openai/gpt-oss-120b': { inputPerMillion: 0.15, outputPerMillion: 0.75 },
      'llama-3.3-70b-versatile': { inputPerMillion: 0.59, outputPerMillion: 0.79 },
      'llama-3.1-8b-instant': { inputPerMillion: 0.05, outputPerMillion: 0.08 },
    },
  },
  openrouter: {
    default: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
    models: {
      'google/gemini-2.5-flash': { inputPerMillion: 0.3, outputPerMillion: 2.5 },
      'google/gemini-2.5-pro': { inputPerMillion: 1.25, outputPerMillion: 10 },
    },
  },
  gemini: {
    default: { inputPerMillion: 0.3, outputPerMillion: 2.5 },
    models: {
      'gemini-2.5-flash': { inputPerMillion: 0.3, outputPerMillion: 2.5 },
      'gemini-2.5-flash-lite': { inputPerMillion: 0.1, outputPerMillion: 0.4 },
      'gemini-2.5-pro': { inputPerMillion: 1.25, outputPerMillion: 10 },
      'gemini-flash-lite-latest': { inputPerMillion: 0.1, outputPerMillion: 0.4 },
    },
  },
}

/**
 * Lam tron `value` ve `digits` chu so thap phan.
 *
 * `cost_usd` trong DB la `numeric(12, 6)` → lam tron 6 chu so de khong
 * lam tron 2 lan (lan 1 o JS, lan 2 o Postgres).
 *
 * @param value - Gia tri can lam tron.
 * @param digits - So chu so thap phan (mac dinh 6).
 */
export function roundTo(value: number, digits = 6): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/**
 * Lay gia cua 1 model.
 *
 * Thu tu uu tien: gia rieng cua model → gia mac dinh cua provider →
 * `undefined` (provider khong biet → coi nhu free).
 *
 * @param provider - Id provider.
 * @param model - Ten model.
 */
export function resolveModelPricing(provider: string, model: string): ModelPricing | undefined {
  const providerPricing = PROVIDER_PRICING[provider]
  if (providerPricing === undefined) return undefined

  const exact = providerPricing.models?.[model]
  if (exact !== undefined) return exact

  return providerPricing.default
}

/** Input cua ham tinh chi phi. */
export interface CostInput {
  /** Id provider da su dung. */
  provider: string
  /** Ten model da su dung. */
  model: string
  /** So token input. */
  tokensIn: number
  /** So token output. */
  tokensOut: number
}

/**
 * Tinh chi phi cua 1 luot chat (USD).
 *
 * Cong thuc: `tokensIn / 1e6 * inputPerMillion + tokensOut / 1e6 * outputPerMillion`.
 *
 * Provider la `mock` / `ollama` (local) hoac khong co trong bang gia →
 * tra `0` (khong gia tien thuc te).
 *
 * @param input - Token + provider + model.
 * @returns Chi phi USD, lam tron 6 chu so.
 */
export function calculateCostUsd(input: CostInput): number {
  const pricing = resolveModelPricing(input.provider, input.model)
  if (pricing === undefined) return 0

  const tokensIn = Math.max(0, input.tokensIn)
  const tokensOut = Math.max(0, input.tokensOut)

  const cost =
    (tokensIn / 1_000_000) * pricing.inputPerMillion +
    (tokensOut / 1_000_000) * pricing.outputPerMillion

  return roundTo(cost)
}
