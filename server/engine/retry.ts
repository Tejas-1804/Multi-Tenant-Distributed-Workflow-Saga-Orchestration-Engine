import { RetryPolicy } from '../../src/types/index.ts';

export const DEFAULT_RETRYABLE_STATUSES: number[] = [
  408, 429, 500, 502, 503, 504,
];

export function isRetryableError(
  error: unknown,
  retryPolicy?: RetryPolicy,
): boolean {
  if (!retryPolicy || retryPolicy.maxAttempts <= 1) {
    return false;
  }

  const retryStatuses: number[] =
    retryPolicy.retryOnStatuses?.length
      ? retryPolicy.retryOnStatuses
      : DEFAULT_RETRYABLE_STATUSES;

  if (typeof error === 'object' && error !== null) {
    const status = (error as { status?: number }).status;

    if (typeof status === 'number' && retryStatuses.includes(status)) {
      return true;
    }
  }

  let message = '';

  if (error instanceof Error) {
    message = error.message.toLowerCase();
  } else if (typeof error === 'string') {
    message = error.toLowerCase();
  } else if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    message = error.message.toLowerCase();
  }

  const retryablePatterns = [
    'timeout',
    'timedout',
    'econnrefused',
    'econnreset',
    'enotfound',
    'network',
    'transient',
  ];

  return retryablePatterns.some((pattern) => message.includes(pattern));
}

export function calculateBackoffDelay(
  attempt: number,
  policy: RetryPolicy = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
  },
): number {
  if (attempt <= 1) {
    return 0;
  }

  const initialDelay =
    policy.initialDelayMs > 0 ? policy.initialDelayMs : 1000;

  const multiplier =
    policy.backoffMultiplier > 0 ? policy.backoffMultiplier : 2;

  const delay = initialDelay * Math.pow(multiplier, attempt - 2);
  const jitter = delay * Math.random() * 0.1;

  return Math.min(Math.round(delay + jitter), 30000);
}