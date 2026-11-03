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

      buffer += decoder.decode(value, { stream: true })

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
