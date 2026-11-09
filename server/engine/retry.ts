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

/**
 * Exponential Backoff with AWS Full Jitter Algorithm (Marc Brooker formula)
 * E = min(maxDelay, base * multiplier^(attempt - 2))
 * Sleep = random(0, E)
 * This mitigates microservice synchronization and thundering herd congestion.
 */
export function calculateBackoffDelay(
  attempt: number,
  policy: RetryPolicy = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
  },
  maxDelayMs: number = 30000
): number {
  if (attempt <= 1) {
    return 0;
  }

  const baseDelay = policy.initialDelayMs > 0 ? policy.initialDelayMs : 1000;
  const multiplier = policy.backoffMultiplier > 0 ? policy.backoffMultiplier : 2;

  // Compute theoretical exponential upper ceiling
  const exponentialCeiling = Math.min(
    maxDelayMs,
    baseDelay * Math.pow(multiplier, attempt - 2)
  );

  // Full Jitter: Uniformly distributed between base floor and exponential ceiling
  const fullJitter = Math.floor(Math.random() * (exponentialCeiling - baseDelay * 0.5 + 1)) + Math.floor(baseDelay * 0.5);

  return Math.max(0, Math.min(fullJitter, maxDelayMs));
}

/**
 * Endpoint Failure Circuit-Breaker Tracker
 * Detects cascading external service outages and fast-fails requests when an endpoint is unhealthy.
 */
const circuitBreakerStats = new Map<string, { failures: number; openedAt?: number }>();
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_RESET_TIMEOUT_MS = 30000;

export function checkCircuitBreaker(endpointHost: string): boolean {
  const stats = circuitBreakerStats.get(endpointHost);
  if (!stats || !stats.openedAt) return true; // Circuit closed (healthy)

  if (Date.now() - stats.openedAt > CIRCUIT_RESET_TIMEOUT_MS) {
    circuitBreakerStats.delete(endpointHost); // Half-open / reset
    return true;
  }
  return false; // Circuit open (fast fail)
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