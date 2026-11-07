/**
 * Augment cho Express `Request` — them `sidekickRequestId`.
 *
 * Dung de request-id xuyen suot client → BFF → provider (NFR-MAINT-04).
 * Khong dung `any` — augment chuan cua Express.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.16 (T-M1-14)
 */

declare global {
  namespace Express {
    interface Request {
      /**
       * Request-id cua request hien tai.
       *
       * Do `createRequestIdMiddleware()` gan — luon co gia tri sau khi
       * middleware chay (route handler luon nam sau no trong `app.ts`).
       */
      sidekickRequestId?: string
    }
  }
}

export {}
