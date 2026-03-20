import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { logWarn } from "@/lib/logger";

/**
 * Upstash-backed sliding windows (REST / fetch — no Node-only APIs here).
 *
 * Typical route handler patterns:
 * - Named limits: `const id = getRateLimitIdentifier(request, user.id); const out = await rateLimitForKind("cvAnalysis", id); if (!out.success) return tooManyRequestsResponse(out);`
 * - Preset (checkout / verify): `const denied = await enforceRateLimit(request, user.id, { namespace: "candidate-checkout", preset: "strict" }); if (denied) return denied;`
 */

type Duration = Parameters<typeof Ratelimit.slidingWindow>[1];

let redisSingleton: Redis | null | undefined;
let warnedMissingRedis = false;

function getRedis(): Redis | null {
  if (redisSingleton !== undefined) {
    return redisSingleton;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    redisSingleton = null;
    if (!warnedMissingRedis) {
      warnedMissingRedis = true;
      logWarn(
        "Upstash Redis not configured (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN); rate limits are disabled"
      );
    }
    return null;
  }
  redisSingleton = new Redis({ url, token });
  return redisSingleton;
}

const limiterCache = new Map<string, Ratelimit>();

function getLimiter(limiterKey: string, max: number, window: Duration): Ratelimit {
  const cached = limiterCache.get(limiterKey);
  if (cached) return cached;
  const redis = getRedis();
  if (!redis) {
    throw new Error("getLimiter called without Redis");
  }
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, window),
    prefix: `openscout:rl:${limiterKey}`,
  });
  limiterCache.set(limiterKey, limiter);
  return limiter;
}

/** Sliding-window presets: use via `rateLimit` / `enforceRateLimit` with `{ preset, namespace }`. */
export const RATE_LIMIT_PRESETS = {
  /** Auth, checkout, verification — tight burst control */
  strict: { limit: 20, window: "1 m" as Duration },
  /** AI-ish workloads — moderate burst */
  moderate: { limit: 60, window: "1 m" as Duration },
  /** General reads / low-cost API */
  lenient: { limit: 200, window: "1 m" as Duration },
} as const;

export type RateLimitPreset = keyof typeof RATE_LIMIT_PRESETS;

export type RateLimitConfig =
  | { namespace: string; preset: RateLimitPreset }
  | { namespace: string; limit: number; window: Duration };

function resolveLimiterSpec(config: RateLimitConfig): { limiterKey: string; limit: number; window: Duration } {
  if ("preset" in config) {
    const p = RATE_LIMIT_PRESETS[config.preset];
    return {
      limiterKey: `preset:${config.preset}:${config.namespace}`,
      limit: p.limit,
      window: p.window,
    };
  }
  return {
    limiterKey: `custom:${config.namespace}:${config.limit}:${String(config.window)}`,
    limit: config.limit,
    window: config.window,
  };
}

export type RateLimitDenied = {
  success: false;
  limit: number;
  remaining: number;
  reset: number;
};

export type RateLimitOk = {
  success: true;
  /** False when Redis env is missing (request always allowed). */
  redisConfigured: boolean;
  limit?: number;
  remaining?: number;
  reset?: number;
};

export type RateLimitResult = RateLimitOk | RateLimitDenied;

/**
 * Distributed sliding-window limit (Upstash REST — safe for Vercel serverless / multiple instances).
 * If Redis is not configured, returns `{ success: true, redisConfigured: false }` (no blocking).
 */
export async function rateLimit(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
  if (!getRedis()) {
    return { success: true, redisConfigured: false };
  }
  const { limiterKey, limit, window } = resolveLimiterSpec(config);
  const limiter = getLimiter(limiterKey, limit, window);
  const out = await limiter.limit(identifier);
  if (!out.success) {
    return {
      success: false,
      limit: out.limit,
      remaining: out.remaining,
      reset: out.reset,
    };
  }
  return {
    success: true,
    redisConfigured: true,
    limit: out.limit,
    remaining: out.remaining,
    reset: out.reset,
  };
}

/** Named limits for specific product flows (each has its own Redis key prefix). */
export const RATE_LIMITS = {
  referralAttribute: { limit: 10, window: "1 h" as Duration },
  jobApplications: { limit: 5, window: "1 h" as Duration },
  mockInterview: { limit: 60, window: "1 h" as Duration },
  tts: { limit: 30, window: "1 h" as Duration },
  cvAnalysis: { limit: 5, window: "1 m" as Duration },
  interviewResult: { limit: 5, window: "1 m" as Duration },
} as const;

export type RateLimitKind = keyof typeof RATE_LIMITS;

/** Same windows as {@link RATE_LIMITS}, for use with {@link tooManyRequestsResponse} (Retry-After). */
export async function rateLimitForKind(kind: RateLimitKind, identifier: string): Promise<RateLimitResult> {
  const cfg = RATE_LIMITS[kind];
  return rateLimit(identifier, { namespace: kind, limit: cfg.limit, window: cfg.window });
}

/**
 * Returns true if the request is allowed, false if rate limit exceeded.
 * When Upstash env vars are missing, returns true (limits disabled).
 */
export async function checkRateLimit(kind: RateLimitKind, identifier: string): Promise<boolean> {
  const r = await rateLimitForKind(kind, identifier);
  return r.success;
}

/** Prefer authenticated user id; otherwise first public client IP from proxy headers. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  return "unknown";
}

/** Stable bucket id: logged-in users by id, anonymous by IP. */
export function getRateLimitIdentifier(request: Request, userId: string | null | undefined): string {
  if (userId && typeof userId === "string" && userId.trim()) {
    return `u:${userId.trim()}`;
  }
  return `ip:${getClientIp(request)}`;
}

export function tooManyRequestsResponse(denied?: RateLimitDenied): NextResponse {
  const headers = new Headers();
  if (denied?.reset) {
    const seconds = Math.max(1, Math.ceil((denied.reset - Date.now()) / 1000));
    headers.set("Retry-After", String(seconds));
  }
  return NextResponse.json({ error: "Too many requests" }, { status: 429, headers });
}

/**
 * Runs rate limiting for a route handler. Returns a 429 `NextResponse` when limited, or `null` when OK.
 *
 * @example
 * const denied = await enforceRateLimit(request, user.id, {
 *   namespace: "employer-checkout",
 *   preset: "strict",
 * });
 * if (denied) return denied;
 */
export async function enforceRateLimit(
  request: Request,
  userId: string | null | undefined,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const id = getRateLimitIdentifier(request, userId);
  const result = await rateLimit(id, config);
  if (!result.success) {
    return tooManyRequestsResponse(result);
  }
  return null;
}
