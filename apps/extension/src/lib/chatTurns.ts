/**
 * Helper thuan cho turn / variant / branch (T-M1-10).
 *
 * Khong phu thuoc Chrome API hay React → test duoc trong vitest.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.11
 */

/** Mot message trong UI (chi can cac truong lien quan den turn). */
export interface TurnMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  /** Id cua turn chua message nay. */
  turnId?: string | undefined
  /** Chi so bien the assistant trong turn (0-based). */
  variantIndex?: number | undefined
  /** Message nam tren duong di active. */
  active?: boolean | undefined
  /** Bi stop giua chung. */
  aborted?: boolean | undefined
  createdAt?: number | undefined
}

/** Mot turn (luot hoi–dap) trong UI. */
export interface TurnGroup<T extends TurnMessage = TurnMessage> {
  turnId: string
  userMessage: T | undefined
  /** Cac bien the assistant, sap xep theo `variantIndex`. */
  variants: T[]
  /** Bien the dang active. */
  activeVariant: T | undefined
  /** Noi dung cau hoi cua turn (lay tu user message). */
  userContent: string
  /** Turn nam tren duong di active cua conversation. */
  onPath: boolean
}

/**
 * Gom message theo turn.
 *
 * Message khong co `turnId` → coi nhu thuoc turn rieng (`legacy-<id>`),
 * tuong thich voi du lieu tao truoc T-M1-10.
 *
 * @param messages - Danh sach message cua thread.
 */
export function groupTurns<T extends TurnMessage>(
  messages: readonly T[],
): TurnGroup<T>[] {
  const groups = new Map<string, T[]>()

  for (const message of messages) {
    const turnId = message.turnId ?? `legacy-${message.id}`
    const list = groups.get(turnId) ?? []
    list.push(message)
    groups.set(turnId, list)
  }

  const result: TurnGroup<T>[] = []

  for (const [turnId, list] of groups) {
    const userMessage = list.find((message) => message.role === 'user')
    const variants = list
      .filter((message) => message.role !== 'user')
      .sort((a, b) => (a.variantIndex ?? 0) - (b.variantIndex ?? 0))

    // Bien the active: `active === true` → neu khong co → bien the dau tien.
    const activeVariant =
      variants.find((message) => message.active === true) ?? variants[0]

    result.push({
      turnId,
      userMessage,
      variants,
      activeVariant,
      userContent: userMessage?.content ?? '',
      onPath: true,
    })
  }

  return result
}

/**
 * Loc message thuoc duong di active.
 *
 * - Turn khong nam trong `path` → bi loai (nhanh cu).
 * - Turn nam trong `path` → giu user message + bien the active.
 *
 * @param messages - Danh sach message cua thread.
 * @param path - Duong di active (danh sach `turnId`).
 */
export function activePathMessages<T extends TurnMessage>(
  messages: readonly T[],
  path: readonly string[],
): T[] {
  if (path.length === 0) return [...messages]

  const pathSet = new Set(path)
  const result: T[] = []

  for (const group of groupTurns(messages)) {
    if (!pathSet.has(group.turnId)) continue
    if (group.userMessage !== undefined) result.push(group.userMessage)
    if (group.activeVariant !== undefined) result.push(group.activeVariant)
  }

  return result
}

/**
 * Lay cac turn khong con tren duong di active (nhanh cu).
 *
 * @param messages - Danh sach message cua thread.
 * @param path - Duong di active (danh sach `turnId`).
 */
export function offPathTurns<T extends TurnMessage>(
  messages: readonly T[],
  path: readonly string[],
): TurnGroup<T>[] {
  if (path.length === 0) return []
  const pathSet = new Set(path)
  return groupTurns(messages)
    .filter((group) => !pathSet.has(group.turnId))
    .map((group) => ({ ...group, onPath: false }))
}

/**
 * Doi bien the active cua 1 turn.
 *
 * Bien the moi → `active = true`; bien the cu → `active = false`.
 * Cac message khac thuoc turn khong doi.
 *
 * @param messages - Danh sach message cua thread.
 * @param turnId - Id turn can doi.
 * @param variantIndex - Chi so bien the moi.
 */
export function applyVariantSwitch(
  messages: readonly TurnMessage[],
  turnId: string,
  variantIndex: number,
): TurnMessage[] {
  return messages.map((message) => {
    if (message.turnId !== turnId) return message
    if (message.role === 'user') return message
    return { ...message, active: message.variantIndex === variantIndex }
  })
}

/**
 * Nhan hien thi cua bien the (vd "2/3").
 *
 * @param variants - Danh sach bien the cua turn.
 * @param activeVariant - Bien the dang active.
 */
export function variantLabel(
  variants: readonly TurnMessage[],
  activeVariant: TurnMessage | undefined,
): string | undefined {
  if (variants.length <= 1) return undefined
  const index = variants.findIndex(
    (variant) => variant.id === activeVariant?.id,
  )
  if (index < 0) return undefined
  return `${index + 1}/${variants.length}`
}

/**
 * Cat duong di tai mot turn (dung cho sua & gui lai).
 *
 * @param path - Duong di hien tai.
 * @param parentTurnId - Id turn cha (gia tri moi them vao duong di).
 */
export function branchPath(
  path: readonly string[],
  parentTurnId: string,
): string[] {
  const index = path.indexOf(parentTurnId)
  if (index < 0) return [...path]
  return [...path.slice(0, index), parentTurnId]
}

/**
 * Lay lich su (history) de gui len BFF tu duong di active.
 *
 * Chi gom user message + bien the active, bo qua message rong.
 *
 * @param messages - Danh sach message cua thread.
 * @param path - Duong di active.
 */
export function buildHistory(
  messages: readonly TurnMessage[],
  path: readonly string[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return activePathMessages(messages, path)
    .filter((message) => message.role !== 'system' && message.content.trim().length > 0)
    .map((message) => ({
      role: message.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: message.content,
    }))
}
