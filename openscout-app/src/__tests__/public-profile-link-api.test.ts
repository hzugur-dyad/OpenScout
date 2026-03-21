import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensurePublicProfileSlugForUser } from "@/lib/allocate-public-profile-slug";
import { GET } from "@/app/api/candidate/public-profile-link/route";

const profileRlHoisted = vi.hoisted(() => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: (...args: unknown[]) => profileRlHoisted.enforceRateLimit(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/allocate-public-profile-slug", () => ({
  ensurePublicProfileSlugForUser: vi.fn(),
}));

vi.mock("@/lib/seo/site", () => ({
  getSiteUrl: vi.fn(() => "https://app.example.com"),
}));

function mockSupabaseCandidateWithSlug() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-ppl-1" } } }),
    },
    from(table: string) {
      if (table === "profiles") {
        return {
          select: (_cols: string) => ({
            eq: (_c: string, _v: string) => ({
              maybeSingle: async () => ({
                data: { role: "candidate", first_name: "Ada", public_profile_slug: "ada-dev" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "job_preferences") {
        return {
          select: (_cols: string) => ({
            eq: (_c: string, _v: string) => ({
              maybeSingle: async () => ({
                data: { desired_roles: ["Engineer"], domain: null },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "mock_interviews") {
        return {
          select: (_cols: string) => ({
            eq: (_c: string, _v: string) =>
              Promise.resolve({ data: [{ score: 91 }], error: null }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("GET /api/candidate/public-profile-link", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    vi.mocked(ensurePublicProfileSlugForUser).mockReset();
    profileRlHoisted.enforceRateLimit.mockReset();
    profileRlHoisted.enforceRateLimit.mockResolvedValue(null);
  });

  it("returns 401 and does not rate limit when unauthenticated", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
    } as never);

    const req = new NextRequest("http://localhost/api/candidate/public-profile-link");
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(profileRlHoisted.enforceRateLimit).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limit is exceeded", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "user-ppl-1" } } }) },
    } as never);
    profileRlHoisted.enforceRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );

    const req = new NextRequest("http://localhost/api/candidate/public-profile-link");
    const res = await GET(req);
    expect(res.status).toBe(429);
    expect(profileRlHoisted.enforceRateLimit).toHaveBeenCalledWith(
      req,
      "user-ppl-1",
      expect.objectContaining({ namespace: "candidate-public-profile-link", preset: "lenient" })
    );
  });

  it("returns 200 and applies user-based rate limit for candidate with slug", async () => {
    vi.mocked(createClient).mockResolvedValue(mockSupabaseCandidateWithSlug() as never);

    const req = new NextRequest("http://localhost/api/candidate/public-profile-link");
    const res = await GET(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      slug: "ada-dev",
      profileUrl: "https://app.example.com/u/ada-dev",
      analytics: { role: "Engineer", best_score: 91 },
    });
    expect(profileRlHoisted.enforceRateLimit).toHaveBeenCalledWith(
      req,
      "user-ppl-1",
      expect.objectContaining({ namespace: "candidate-public-profile-link", preset: "lenient" })
    );
    expect(ensurePublicProfileSlugForUser).not.toHaveBeenCalled();
  });
});
