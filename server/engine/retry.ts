import { RetryPolicy } from '../../src/types/index.ts';

export const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];

export function isRetryableError(error: any, retryPolicy?: RetryPolicy): boolean {
  if (!retryPolicy || retryPolicy.maxAttempts <= 1) return false;

  const retryStatuses = retryPolicy.retryOnStatuses && retryPolicy.retryOnStatuses.length > 0
    ? retryPolicy.retryOnStatuses
    : DEFAULT_RETRYABLE_STATUSES;

  if (error?.status && retryStatuses.includes(error.status)) {
    return true;
  }

  // Network failures or timeouts
  const msg = (error?.message || '').toLowerCase();
  if (
    msg.includes('timeout') ||
    msg.includes('timedout') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('enotfound') ||
    msg.includes('network') ||
    msg.includes('transient')
  ) {
    return true;
  }

  return false;
}

export function calculateBackoffDelay(
  attempt: number,
  policy: RetryPolicy = { maxAttempts: 3, initialDelayMs: 1000, backoffMultiplier: 2 }
): number {
  if (attempt <= 1) return 0;
  // exponential backoff: delay = initialDelay * (multiplier ^ (attempt - 2))
  const multiplier = policy.backoffMultiplier || 2;
  const initial = policy.initialDelayMs || 1000;
  const calculated = initial * Math.pow(multiplier, attempt - 2);
  // Add 10% jitter to prevent thundering herds
  const jitter = calculated * (Math.random() * 0.1);
  return Math.min(Math.round(calculated + jitter), 30000); // capped at 30s
}
