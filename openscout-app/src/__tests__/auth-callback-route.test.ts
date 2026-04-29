import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/auth/callback/route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/analytics-server", () => ({
  captureServer: vi.fn(),
}));

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        exchangeCodeForSession: async () => ({ error: null }),
        getUser: async () => ({ data: { user: null } }),
      },
    } as never);
  });

  it("rejects absolute next URLs and falls back to dashboard", async () => {
    const res = await GET(
      new Request("https://openscout.example/auth/callback?code=ok&next=https://evil.example/phish")
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://openscout.example/dashboard");
  });

  it("keeps valid internal next paths", async () => {
    const res = await GET(
      new Request("https://openscout.example/auth/callback?code=ok&next=/mock-interview")
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://openscout.example/mock-interview");
  });
});
