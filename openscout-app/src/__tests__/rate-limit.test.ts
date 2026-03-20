import { beforeEach, describe, expect, it, vi } from "vitest";

describe("rate-limit", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
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
});
