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
  strategy: 'proportional' | 'full-jitter' = 'proportional'
): number {
  if (attempt <= 1) return 0;

  const initialDelay = policy.initialDelayMs > 0 ? policy.initialDelayMs : 1000;
  const multiplier = policy.backoffMultiplier > 0 ? policy.backoffMultiplier : 2;
  const delay = initialDelay * Math.pow(multiplier, attempt - 2);

  if (strategy === 'full-jitter') {
    // AWS Full Jitter Algorithm (Marc Brooker formula): Uniform random between 0 and delay
    return Math.min(Math.round(Math.random() * delay), 30000);
  }

  const jitter = delay * Math.random() * 0.1;
  return Math.min(Math.round(delay + jitter), 30000);
}

/**
 * AWS Full Jitter backoff calculator (Task 4)
 */
export function calculateFullJitterBackoff(
  attempt: number,
  policy?: RetryPolicy
): number {
  return calculateBackoffDelay(attempt, policy, 'full-jitter');
}

/**
 * Endpoint Failure Circuit-Breaker Tracker (Task 4)
 * Detects cascading external service outages and fast-fails requests when an endpoint is unhealthy.
 */
const circuitBreakerStats = new Map<string, { failures: number; openedAt?: number }>();
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_RESET_TIMEOUT_MS = 30000;

export function checkCircuitBreaker(endpointHost: string): boolean {
  const stats = circuitBreakerStats.get(endpointHost);
  if (!stats || !stats.openedAt) return true;

  if (Date.now() - stats.openedAt > CIRCUIT_RESET_TIMEOUT_MS) {
    circuitBreakerStats.delete(endpointHost);
    return true;
  }
  return false;
}

export function recordCircuitFailure(endpointHost: string): void {
  const stats = circuitBreakerStats.get(endpointHost) || { failures: 0 };
  stats.failures++;
  if (stats.failures >= CIRCUIT_THRESHOLD) {
    stats.openedAt = Date.now();
  }
  circuitBreakerStats.set(endpointHost, stats);
}

export function recordCircuitSuccess(endpointHost: string): void {
  circuitBreakerStats.delete(endpointHost);
}