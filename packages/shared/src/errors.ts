/**
 * Error codes chuan cua Sidekick AI.
 * Moi loi ra ngoai deu phai map ve mot trong cac code nay (rule backend).
 */

export const ERROR_CODES = {
  // 4xx — client
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',

  // 5xx — server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',

  // Provider / upstream
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  PROVIDER_RATE_LIMITED: 'PROVIDER_RATE_LIMITED',
  PROVIDER_QUOTA_EXCEEDED: 'PROVIDER_QUOTA_EXCEEDED',
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',

  // Key / config
  MISSING_API_KEY: 'MISSING_API_KEY',
  INVALID_API_KEY: 'INVALID_API_KEY',

  // Database
  DB_ERROR: 'DB_ERROR',

  // Stream
  CLIENT_ABORTED: 'CLIENT_ABORTED',
  STREAM_ERROR: 'STREAM_ERROR',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

/** HTTP status mac dinh cho tung error code. */
export const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,

  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  TIMEOUT: 504,

  PROVIDER_ERROR: 502,
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_RATE_LIMITED: 429,
  PROVIDER_QUOTA_EXCEEDED: 429,
  MODEL_NOT_FOUND: 404,

  MISSING_API_KEY: 500,
  INVALID_API_KEY: 401,

  DB_ERROR: 500,

  CLIENT_ABORTED: 499,
  STREAM_ERROR: 500,
}

/** Error chuan hoa moi dien ra ngoai server. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode
    message: string
    details?: Record<string, unknown>
  }
}

/**
 * Lop loi chuan cua BFF — luon mang error code de client xu ly duoc.
 */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details: Record<string, unknown> | undefined

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = ERROR_STATUS_MAP[code]
    this.details = details
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    }
  }
}
