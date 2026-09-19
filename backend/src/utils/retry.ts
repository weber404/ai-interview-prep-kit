/**
 * Minimal retry helper for transient provider failures.
 *
 * Intentionally small — later pipeline stages reuse it as-is. There is a hard
 * attempt cap and no unbounded loop.
 */

export interface RetryOptions {
  /** Total attempts including the first. */
  attempts: number;
  /** Base delay; attempt n waits baseDelayMs * 2^(n-1). */
  baseDelayMs?: number;
  /** Return false to fail immediately (e.g. bad credentials). */
  isRetryable: (error: unknown) => boolean;
  /** Called before each retry, for logging. */
  onRetry?: (error: unknown, attempt: number) => void;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const attempts = Math.max(1, options.attempts);
  const baseDelayMs = options.baseDelayMs ?? 250;
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === attempts;
      if (isLastAttempt || !options.isRetryable(error)) throw error;

      options.onRetry?.(error, attempt);
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}
