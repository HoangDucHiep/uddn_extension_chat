/**
 * Blind mapping cho LLM-as-judge (T-M2-14).
 *
 * Nguyen tac (FC-6 trong [`EVAL_PLAN.md`](../../../../docs/EVAL_PLAN.md) §9):
 * judge **khong** biet he thong nao dang duoc cham → moi duoc gan nhan
 * gia (`system_A` · `system_B` · `system_C`).
 *
 * Mapping duoc sinh **deterministic** theo seed → chay lai cho cung ket
 * qua (khong dao nhan giữa 2 lan chay → so sanh duoc).
 *
 * File mapping chi mo sau khi cham xong (`blind_map.json`).
 *
 * Docs: docs/EVAL_PLAN.md §7.2, §9 (FC-6)
 */

/** He thong co the duoc cham trong eval. */
export const EVAL_SYSTEMS = ['sidekick', 'edge-copilot', 'chrome-gemini'] as const
export type EvalSystem = (typeof EVAL_SYSTEMS)[number]

/** Nhan gia cho he thong (A · B · C). */
export const BLIND_LABELS = ['system_A', 'system_B', 'system_C'] as const
export type BlindLabel = (typeof BLIND_LABELS)[number]

/** Mapping nhan gia → he thong that. */
export type BlindMap = Record<BlindLabel, EvalSystem>

/**
 * Hash FNV-1a 32-bit — cung thuat toan voi `packages/shared/src/contextHash.ts`.
 *
 * @param value - Chuoi can hash.
 */
function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/**
 * Tao blind map **deterministic** theo seed.
 *
 * Dung `seed` (VD id cua run) → cung seed cho cung mapping. Hoan vi hoan
 * toan → moi nhan gia gan 1 he thong.
 *
 * @param systems - Danh sach he thong can gan nhan.
 * @param seed - Chuoi seed.
 */
export function createBlindMap(
  systems: readonly EvalSystem[] = EVAL_SYSTEMS,
  seed: string,
): BlindMap {
  const labels = BLIND_LABELS.slice(0, systems.length)
  const entries = labels.map((label) => ({ label, value: hashString(`${seed}:${label}`) }))

  // Sap xep theo hash → thu tu gan nhan khong phu thuoc thu tu input.
  entries.sort((a, b) => a.value - b.value)

  const map = {} as BlindMap
  for (const [index, entry] of entries.entries()) {
    const system = systems[index]
    if (system === undefined) continue
    map[entry.label] = system
  }

  return map
}

/**
 * Dao nhan gia → he thong that.
 *
 * @param map - Blind map.
 * @param label - Nhan gia.
 */
export function revealSystem(map: BlindMap, label: BlindLabel): EvalSystem | undefined {
  return map[label]
}

/**
 * Ten he thong that → nhan gia (nguoc cua `revealSystem`).
 *
 * @param map - Blind map.
 * @param system - He thong that.
 */
export function blindLabelFor(map: BlindMap, system: EvalSystem): BlindLabel | undefined {
  const entry = (Object.entries(map) as Array<[BlindLabel, EvalSystem]>).find(
    ([, value]) => value === system,
  )
  return entry?.[0]
}
