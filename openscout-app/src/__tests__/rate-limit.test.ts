import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upstashMocks = vi.hoisted(() => ({
  limitMock: vi.fn().mockResolvedValue({
    success: true,
    limit: 20,
    remaining: 19,
    reset: Date.now() + 60_000,
  }),
}));

vi.mock("@upstash/redis", () => ({
  Redis: class RedisMock {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_opts: { url: string; token: string }) {}
  },
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class RatelimitMock {
    static slidingWindow = () => ({});
    limit = (...args: unknown[]) => upstashMocks.limitMock(...args);
  },
}));

describe("rate-limit", () => {
  const savedUrl = process.env.UPSTASH_REDIS_REST_URL;
  const savedToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    vi.resetModules();
    upstashMocks.limitMock.mockReset();
    upstashMocks.limitMock.mockResolvedValue({
      success: true,
      limit: 20,
      remaining: 19,
      reset: Date.now() + 60_000,
    });
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    if (savedUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = savedUrl;
    if (savedToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = savedToken;
  });

  it("exposes RATE_LIMITS with expected limits", async () => {
    const { RATE_LIMITS } = await import("@/lib/rate-limit");
    expect(RATE_LIMITS.jobApplications.limit).toBe(5);
    expect(RATE_LIMITS.cvAnalysis).toEqual({ limit: 5, window: "1 m" });
  });

  it("exposes RATE_LIMIT_PRESETS", async () => {
    const { RATE_LIMIT_PRESETS } = await import("@/lib/rate-limit");
    expect(RATE_LIMIT_PRESETS.strict.limit).toBe(20);
    expect(RATE_LIMIT_PRESETS.moderate.limit).toBe(60);
    expect(RATE_LIMIT_PRESETS.lenient.limit).toBe(200);
  });

  it("allows requests when Upstash Redis is not configured", async () => {
    const { checkRateLimit, rateLimit } = await import("@/lib/rate-limit");
    await expect(checkRateLimit("jobApplications", "u:user-1")).resolves.toBe(true);
    const r = await rateLimit("u:x", { namespace: "test", preset: "strict" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.redisConfigured).toBe(false);
  });

  it("logs production error when Redis env is missing (still fail-open)", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      vi.resetModules();
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      const logger = await import("@/lib/logger");
      const logErrorSpy = vi.spyOn(logger, "logError").mockImplementation(() => {});
      const logWarnSpy = vi.spyOn(logger, "logWarn").mockImplementation(() => {});
      const { rateLimit } = await import("@/lib/rate-limit");
      await rateLimit("u:prod-rl", { namespace: "prod-test-ns", preset: "strict" });
      expect(logWarnSpy).toHaveBeenCalled();
      expect(logErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("DISABLED"),
        expect.objectContaining({ rate_limits_disabled: true, monitoring: "rate_limit_config" }),
      );
      logErrorSpy.mockRestore();
      logWarnSpy.mockRestore();
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
    }
  });

  it("getRateLimitIdentifier prefers user id", async () => {
    const { getRateLimitIdentifier } = await import("@/lib/rate-limit");
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    expect(getRateLimitIdentifier(req, "abc")).toBe("u:abc");
    expect(getRateLimitIdentifier(req, null)).toBe("ip:1.2.3.4");
  });

  it("tooManyRequestsResponse returns standard JSON body", async () => {
    const { tooManyRequestsResponse } = await import("@/lib/rate-limit");
    const res = tooManyRequestsResponse();
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({ error: "Too many requests" });
  });

  describe("with mocked Upstash (env configured)", () => {
    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";
    });

    it("rateLimit uses authenticated identifier and calls limiter with the same key", async () => {
      const { rateLimit, getRateLimitIdentifier } = await import("@/lib/rate-limit");
      const req = new Request("https://example.com", {
        headers: { "x-forwarded-for": "5.5.5.5" },
      });
      expect(getRateLimitIdentifier(req, "user-99")).toBe("u:user-99");

      const r = await rateLimit("u:user-99", { namespace: "ns", limit: 10, window: "1 m" });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.redisConfigured).toBe(true);
        expect(r.limit).toBe(20);
      }
      expect(upstashMocks.limitMock).toHaveBeenCalledWith("u:user-99");
    });

    it("rateLimit falls back to ip: prefix when user id is missing", async () => {
      const { rateLimit, getRateLimitIdentifier } = await import("@/lib/rate-limit");
      const req = new Request("https://example.com", {
        headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
      });
      const id = getRateLimitIdentifier(req, null);
      expect(id).toBe("ip:203.0.113.10");

      await rateLimit(id, { namespace: "anon", limit: 10, window: "1 m" });
      expect(upstashMocks.limitMock).toHaveBeenCalledWith("ip:203.0.113.10");
    });

    it("returns success false when limiter denies and tooManyRequestsResponse adds Retry-After", async () => {
      const reset = Date.now() + 8000;
      upstashMocks.limitMock.mockResolvedValueOnce({
        success: false,
        limit: 5,
        remaining: 0,
        reset,
      });

      const { rateLimit, tooManyRequestsResponse } = await import("@/lib/rate-limit");
      const denied = await rateLimit("u:blocked", { namespace: "ns", limit: 5, window: "1 m" });
      expect(denied.success).toBe(false);
      if (!denied.success) {
        expect(denied.limit).toBe(5);
        expect(denied.remaining).toBe(0);
      }

      const res = tooManyRequestsResponse(denied as never);
      expect(res.status).toBe(429);
      const retryAfter = res.headers.get("Retry-After");
      expect(retryAfter).toBeTruthy();
      expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);
    });

    it("enforceRateLimit returns 429 NextResponse when limited", async () => {
      upstashMocks.limitMock.mockResolvedValueOnce({
        success: false,
        limit: 3,
        remaining: 0,
        reset: Date.now() + 4000,
      });
      const { enforceRateLimit } = await import("@/lib/rate-limit");
      const req = new Request("https://example.com");
      const denied = await enforceRateLimit(req, "u-7", { namespace: "checkout", preset: "strict" });
      expect(denied).not.toBeNull();
      expect(denied!.status).toBe(429);
    });
  });
});
