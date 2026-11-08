/**
 * Sinh nội dung xuất cuộc trò chuyện (FR-CHAT-10 — T-M1-13).
 *
 * Module **thuần**: khong DOM, khong Zod, khong Chrome API → test duoc
 * truc tiep trong vitest. Phan tao file thuoc `lib/downloadFile.ts`.
 *
 * 2 dinh dang:
 *  - Markdown (`.md`) — de doc bang trinh xem Markdown / Notepad.
 *  - JSON (`.json`) — de xu ly tiep (may) va giu duoc metadata day du.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.20
 */

/** Mot nguon trich dan cua message (FR-CONTEXT-10). */
export interface ExportCitation {
  /** Chi so marker `[N]` trong noi dung message. */
  index: number
  /** URL cua trang nguon. */
  url: string
  /** Tieu de trang nguon. */
  title: string
  /** Doan trich dan (neu co). */
  snippet?: string | undefined
}

/** Mot message can xuat. */
export interface ExportMessage {
  /** Vai tro cua message. */
  role: 'user' | 'assistant' | 'system'
  /** Noi dung (Markdown thoi). */
  content: string
  /** Thoi diem tao (epoch ms). */
  createdAt: number
  /** Provider da sinh message. */
  provider?: string | undefined
  /** Model da sinh message. */
  model?: string | undefined
  /** So token input. */
  tokensIn?: number | undefined
  /** So token output. */
  tokensOut?: number | undefined
  /** Request-id de doi chieu voi `request_logs` (T-M1-14). */
  requestId?: string | undefined
  /** Cac nguon trich dan. */
  citations?: readonly ExportCitation[] | undefined
}

/** Cuoc trò chuyện can xuat. */
export interface ExportConversation {
  /** Id conversation tren server (co the rong khi chat chua tao conversation). */
  id?: string | undefined
  /** Tieu de cuoc trò chuyện. */
  title: string
  /** Cac message theo thu tu hien thi. */
  messages: readonly ExportMessage[]
  /** Thoi diem xuat (mac dinh `new Date()`). */
  exportedAt?: Date | undefined
}

/** Version cua format JSON — tang khi doi shape. */
export const EXPORT_FORMAT_VERSION = 1

/** Do dai toi da cua phan ten file (ky tu). */
const MAX_FILE_NAME_TITLE_CHARS = 60

/** Ky tu Windows khong cho phep trong ten file. */
const INVALID_FILE_NAME_CHARS = /[<>:"/\\|?*]/g

/**
 * Chuyen timestamp (epoch ms) thanh chuoi ISO.
 *
 * @param value - Timestamp epoch ms.
 */
function toIso(value: number): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

/**
 * Format timestamp cho ten file (theo gio dia phuong).
 *
 * @param value - Timestamp epoch ms.
 */
function toLocalStamp(value: number): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '00000000-0000'
  const pad = (n: number): string => String(n).padStart(2, '0')
  return [
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`,
    `${pad(date.getHours())}${pad(date.getMinutes())}`,
  ].join('-')
}

/**
 * Ve metadata 1 message (provider / model / token / request-id).
 *
 * @param message - Message can ve metadata.
 */
function buildMetaLine(message: ExportMessage): string | undefined {
  const parts: string[] = []

  if (message.provider !== undefined && message.provider.length > 0) {
    parts.push(message.provider)
  }
  if (message.model !== undefined && message.model.length > 0) {
    parts.push(message.model)
  }
  if (message.tokensIn !== undefined || message.tokensOut !== undefined) {
    parts.push(`${message.tokensIn ?? 0}/${message.tokensOut ?? 0} tokens`)
  }
  if (message.requestId !== undefined && message.requestId.length > 0) {
    parts.push(`req ${message.requestId.slice(0, 6)}`)
  }

  if (parts.length === 0) return undefined
  return parts.join(' · ')
}

/**
 * Tieu de tinh theo vai tro (dich san de giu file khong phu thuoc i18n).
 *
 * @param role - Vai tro cua message.
 */
function roleHeading(role: ExportMessage['role']): string {
  if (role === 'user') return '## Người dùng'
  if (role === 'assistant') return '## Trợ lý'
  return '## Hệ thống'
}

/**
 * Sinh noi dung Markdown cua cuoc trò chuyện.
 *
 * Metadata duoc gom o dau file (de doc nhanh) + tren tung message
 * assistant (de doi chieu tung luot voi `request_logs`).
 *
 * @param conversation - Cuoc trò chuyện can xuat.
 */
export function buildMarkdownExport(conversation: ExportConversation): string {
  const exportedAt = conversation.exportedAt ?? new Date()
  const lines: string[] = []

  lines.push(`# ${conversation.title.length > 0 ? conversation.title : 'Cuộc trò chuyện'}`)
  lines.push('')
  lines.push(`- Xuất lúc: ${exportedAt.toISOString()}`)
  if (conversation.id !== undefined && conversation.id.length > 0) {
    lines.push(`- Conversation ID: ${conversation.id}`)
  }
  lines.push(`- Số tin nhắn: ${conversation.messages.length}`)
  lines.push('')

  for (const message of conversation.messages) {
    if (message.content.trim().length === 0) continue

    lines.push(roleHeading(message.role))
    lines.push('')

    const createdAt = toIso(message.createdAt)
    if (createdAt.length > 0) {
      lines.push(`*${createdAt}*`)
      lines.push('')
    }

    const meta = buildMetaLine(message)
    if (meta !== undefined) {
      lines.push(`> ${meta}`)
      lines.push('')
    }

    lines.push(message.content)
    lines.push('')

    if (message.citations !== undefined && message.citations.length > 0) {
      lines.push('**Nguồn:**')
      lines.push('')
      for (const citation of message.citations) {
        lines.push(`- [${citation.index}] [${citation.title}](${citation.url})`)
      }
      lines.push('')
    }
  }

  return `${lines.join('\n').trimEnd()}\n`
}

/** Message sau khi serialize sang JSON. */
export interface ExportJsonMessage {
  role: ExportMessage['role']
  content: string
  createdAt: string
  provider?: string
  model?: string
  tokensIn?: number
  tokensOut?: number
  requestId?: string
  citations?: Array<{
    index: number
    url: string
    title: string
    snippet?: string
  }>
}

/** Shape cua file JSON xuat cuoc tro chuyen. */
export interface ExportJsonPayload {
  version: number
  exportedAt: string
  conversation: {
    id?: string
    title: string
  }
  messages: ExportJsonMessage[]
}

/**
 * Sinh doi tuong JSON cua cuoc trò chuyện.
 *
 * @param conversation - Cuoc trò chuyện can xuat.
 */
export function buildJsonExport(conversation: ExportConversation): ExportJsonPayload {
  const exportedAt = conversation.exportedAt ?? new Date()

  return {
    version: EXPORT_FORMAT_VERSION,
    exportedAt: exportedAt.toISOString(),
    conversation: {
      ...(conversation.id !== undefined ? { id: conversation.id } : {}),
      title: conversation.title,
    },
    messages: conversation.messages.map((message) => ({
      role: message.role,
      content: message.content,
      createdAt: toIso(message.createdAt),
      ...(message.provider !== undefined ? { provider: message.provider } : {}),
      ...(message.model !== undefined ? { model: message.model } : {}),
      ...(message.tokensIn !== undefined ? { tokensIn: message.tokensIn } : {}),
      ...(message.tokensOut !== undefined ? { tokensOut: message.tokensOut } : {}),
      ...(message.requestId !== undefined ? { requestId: message.requestId } : {}),
      ...(message.citations !== undefined && message.citations.length > 0
        ? {
            citations: message.citations.map((citation) => ({
              index: citation.index,
              url: citation.url,
              title: citation.title,
              ...(citation.snippet !== undefined ? { snippet: citation.snippet } : {}),
            })),
          }
        : {}),
    })),
  }
}

/**
 * Sinh ten file an toan cho Windows/macOS/Linux.
 *
 * @param title - Tieu de cuoc trò chuyện.
 * @param extension - Duoi file (vd `md`).
 * @param at - Thoi diem dung trong ten file.
 */
export function buildExportFileName(
  title: string,
  extension: 'md' | 'json',
  at: Date = new Date(),
): string {
  const safeTitle =
    title
      .replace(INVALID_FILE_NAME_CHARS, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_FILE_NAME_TITLE_CHARS)
      .trim() || 'conversation'

  return `sidekick-${safeTitle}-${toLocalStamp(at.getTime())}.${extension}`
}
