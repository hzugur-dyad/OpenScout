import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseForEmployerApplicationPatch } from "@/test/supabase-mocks";

const employerRlHoisted = vi.hoisted(() => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: (...args: unknown[]) => employerRlHoisted.enforceRateLimit(...args),
}));

import { PATCH } from "@/app/api/employer/applications/[applicationId]/route";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  employerRlHoisted.enforceRateLimit.mockReset();
  employerRlHoisted.enforceRateLimit.mockResolvedValue(null);
});

describe("PATCH /api/employer/applications/[applicationId]", () => {
  it("returns 401 when unauthenticated", async () => {
    const { client } = createSupabaseForEmployerApplicationPatch({
      authUserId: null,
      application: { id: "app-1", job_id: "job-1" },
      job: { id: "job-1", company_id: "co-1" },
      company: { user_id: "emp-1", stripe_subscription_status: "active" },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/employer/applications/app-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "shortlisted" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ applicationId: "app-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not the subscribed company owner (candidate or other employer)", async () => {
    const { client } = createSupabaseForEmployerApplicationPatch({
      authUserId: "candidate-1",
      application: { id: "app-1", job_id: "job-1" },
      job: { id: "job-1", company_id: "co-1" },
      company: { user_id: "real-owner", stripe_subscription_status: "active" },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/employer/applications/app-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "shortlisted" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ applicationId: "app-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 403 when subscription is not active", async () => {
    const { client } = createSupabaseForEmployerApplicationPatch({
      authUserId: "emp-1",
      application: { id: "app-1", job_id: "job-1" },
      job: { id: "job-1", company_id: "co-1" },
      company: { user_id: "emp-1", stripe_subscription_status: "canceled" },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/employer/applications/app-1", {
      method: "PATCH",
      body: JSON.stringify({ notes: "ok" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ applicationId: "app-1" }) });
    expect(res.status).toBe(403);
  });

  it("allows authenticated employer owner with active subscription", async () => {
    const { client, updateMock } = createSupabaseForEmployerApplicationPatch({
      authUserId: "emp-1",
      application: { id: "app-1", job_id: "job-1" },
      job: { id: "job-1", company_id: "co-1" },
      company: { user_id: "emp-1", stripe_subscription_status: "active" },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/employer/applications/app-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "rejected" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ applicationId: "app-1" }) });
    expect(res.status).toBe(200);
    expect(employerRlHoisted.enforceRateLimit).toHaveBeenCalledWith(
      req,
      "emp-1",
      expect.objectContaining({ namespace: "employer-application-patch", preset: "moderate" })
    );
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(updateMock).toHaveBeenCalled();
    const patch = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(patch.application_status).toBe("rejected");
  });
});
