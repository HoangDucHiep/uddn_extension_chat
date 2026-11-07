/**
 * Helper parse SSE — dung chung cho cac provider.
 */

/** Parse mot khoi SSE raw -> gia tri field `data` (neu co). */
export function parseSseEvent(raw: string): string | undefined {
  const lines = raw.split(/\r?\n/)
  const dataLines: string[] = []

  for (const line of lines) {
    // Comment (heartbeat) — bo qua.
    if (line.startsWith(':')) continue
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  if (dataLines.length === 0) return undefined
  return dataLines.join('\n')
}

/**
 * Doc stream SSE va tra ve tung block `data` theo thu tu.
 * Tu tach bo theo \n\n, giu phan chua doc trong buffer.
 */
export async function* readSseData(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, undefined> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      // Chu hoa \r\n thanh \n truoc khi tach — mot so provider (Gemini) dung
      // \r\n\r\n lam separator, neu khong chuan hoa thi indexOf('\n\n') khong match.
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

      let separatorIndex = buffer.indexOf('\n\n')
      while (separatorIndex !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex)
        buffer = buffer.slice(separatorIndex + 2)
        const data = parseSseEvent(rawEvent)
        if (data !== undefined) yield data
        separatorIndex = buffer.indexOf('\n\n')
      }
    }

    // Flush phan con lai (mot so provider khong gui \n\n cuoi).
    const tail = parseSseEvent(buffer)
    if (tail !== undefined) yield tail
  } finally {
    reader.releaseLock()
  }
}

/** Doc body loi dang text, khong nem exception. */
export async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

/** Map HTTP status -> error code chuan. */
export function mapStatusToCode(status: number): string {
  if (status === 401 || status === 403) return 'INVALID_API_KEY'
  if (status === 404) return 'MODEL_NOT_FOUND'
  if (status === 429) return 'PROVIDER_RATE_LIMITED'
  if (status >= 500) return 'PROVIDER_UNAVAILABLE'
  return 'PROVIDER_ERROR'
}

/**
 * Doc so giay cho thu lai tu header `Retry-After` (HTTP 429).
 *
 * Header co 2 dang: so giay (`60`) hoac HTTP-date. Chi so giay duoc xu ly
 * — HTTP-date thi tra `undefined` (client dung gia tri mac dinh 60 giay).
 *
 * @param response - Response cua provider.
 */
export function parseRetryAfterSeconds(response: Response): number | undefined {
  const header = response.headers.get('retry-after')
  if (header === null) return undefined

  const seconds = Number.parseInt(header.trim(), 10)
  if (!Number.isInteger(seconds) || seconds < 0) return undefined
  // tran toi da 10 phut — provider khong bat nguoc nhu vay.
  return Math.min(seconds, 600)
}

/**
 * Loi nay co **duoc user thu lai** khong (theo HTTP status) — muc dich cho **user**.
 *
 * - 401/403 → **khong** (sai API key → retry vo ich) — FR-CHAT-14 / NFR-REL-02.
 * - 429 → **co**, nhung client phai dem nguoc `Retry-After` truoc.
 * - 404 / 5xx → co (model khong ton tai hoac loi tam thoi).
 *
 * @param status - HTTP status tu provider.
 */
export function isRetryableStatus(status: number): boolean {
  return status !== 401 && status !== 403
}

/**
 * Loi nay duoc **thu model khac** trong chuoi fallback khong.
 *
 * Khac voi `isRetryableStatus`: 429 van duoc fallback (model khac co the
 * con quota) — chi khong duoc **user** retry ngay.
 *
 * @param status - HTTP status tu provider.
 */
export function shouldTryFallbackModel(status: number): boolean {
  return status === 404 || status === 429 || status >= 500
}
