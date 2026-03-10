/**
 * In-memory rate limiter. Uses a sliding window per key.
 * Not shared across serverless instances; suitable for single-instance or best-effort limiting.
 */

type Entry = { count: number; windowStart: number };

const store = new Map<string, Entry>();

/**
 * Returns true if the request is allowed, false if rate limit exceeded.
 * @param key - Unique identifier (e.g. IP or user id)
 * @param limit - Max requests allowed in the window
 * @param windowMs - Window duration in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export const RATE_LIMITS = {
  referralAttribute: { limit: 10, windowMs: ONE_HOUR_MS },
  jobApplications: { limit: 5, windowMs: ONE_HOUR_MS },
  mockInterview: { limit: 60, windowMs: ONE_HOUR_MS },
  tts: { limit: 30, windowMs: ONE_HOUR_MS },
} as const;
