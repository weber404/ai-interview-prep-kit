/**
 * Structured, client-safe application errors.
 *
 * Messages on AppError are considered safe to return to the client.
 * Provider internals, credentials and stack traces must never be placed here.
 */

export type AppErrorCode =
  | 'INVALID_JD'
  | 'INVALID_REQUEST'
  | 'INVALID_LLM_OUTPUT'
  | 'LLM_PROVIDER_ERROR'
  | 'LLM_NOT_CONFIGURED'
  | 'INTERNAL_ERROR';

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  INVALID_JD: 400,
  INVALID_REQUEST: 400,
  INVALID_LLM_OUTPUT: 502,
  LLM_PROVIDER_ERROR: 502,
  LLM_NOT_CONFIGURED: 500,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }

  /** The exact JSON body sent to clients. */
  toResponse(): { error: { code: AppErrorCode; message: string } } {
    return { error: { code: this.code, message: this.message } };
  }
}

/**
 * Raised by LLM provider implementations. Never returned to the client
 * directly — the extraction service converts it into an AppError so that
 * provider details stay server-side.
 */
export class ProviderError extends Error {
  /** Transient errors (timeout, rate limit, 5xx) may be retried. */
  readonly retryable: boolean;

  constructor(message: string, options: { retryable: boolean }) {
    super(message);
    this.name = 'ProviderError';
    this.retryable = options.retryable;
  }
}
