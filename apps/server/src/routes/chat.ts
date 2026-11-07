/**
 * Route chat — POST /api/chat tra ve SSE stream.
 *
 * Client (side panel) goi truc tiep toi BFF, doc ReadableStream.
 * KHONG proxy qua service worker (MV3 SW bi kill sau ~30s).
 * Docs: docs/SYSTEM_DESIGN.md §4.3
 */

import { Router, type Request, type Response } from 'express'
import {
  API_ROUTES,
  chatRequestSchema,
  ERROR_CODES,
  type ChatEvent,
} from '@sidekick/shared'
import { createChatStream, type ChatServiceDeps } from '../services/chatService.js'

export function createChatRouter(deps: ChatServiceDeps): Router {
  const router = Router()

  router.post('/chat', async (req: Request, res: Response) => {
    const parsed = chatRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Body chat khong hop le',
          details: { issues: parsed.error.issues },
        },
      })
      return
    }

    // Client huy (dong panel / stop) -> abort signal -> huy request len provider.
    // Phai dung `res.on('close')` chu khong dung `req.on('close')`: req close ngay
    // sau khi body da doc xong, se abort truoc khi stream bat dau.
    const abortController = new AbortController()
    const onClose = (): void => {
      // `writableEnded` true nghia la response da ket thuc binh thuong.
      if (!res.writableEnded) abortController.abort()
    }
    res.on('close', onClose)

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      // Echo request-id de client biet id chinh thuc cua server
      // (NFR-MAINT-04 — T-M1-14).
      'X-Request-Id': req.sidekickRequestId ?? '',
    })

    // Flush headers ngay de client biet stream da bat dau.
    res.flushHeaders?.()

    const stream = createChatStream(deps, parsed.data, abortController.signal, {
      requestId: req.sidekickRequestId,
    })

    try {
      for await (const event of stream.events) {
        writeEvent(res, event)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      writeEvent(res, {
        type: 'error',
        code: ERROR_CODES.STREAM_ERROR,
        message,
        retryable: true,
      })
      writeEvent(res, {
        type: 'done',
        finishReason: 'error',
        messageId: stream.messageId,
      })
    } finally {
      res.off('close', onClose)
      res.end()
    }
  })

  return router
}

/** Ghi mot SSE event theo wire format chuan. */
export function writeEvent(res: Response, event: ChatEvent): void {
  res.write(`event: ${event.type}\n`)
  res.write(`data: ${JSON.stringify(event)}\n\n`)
}

export { API_ROUTES }
