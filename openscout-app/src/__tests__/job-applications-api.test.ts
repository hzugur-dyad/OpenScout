import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/job-applications/route";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseForJobApplicationsRoute } from "@/test/supabase-mocks";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const job = {
  id: "job-1",
  title: "Backend Engineer",
  min_cv_score: 50,
  company_id: null as string | null,
};

const interviewReport = {
  strengths: ["clear"],
  improvements: ["depth"],
  technical_score: 81,
  communication_score: 79,
  problem_solving_score: 77,
};

beforeEach(() => {
  vi.mocked(createClient).mockReset();
});

describe("POST /api/job-applications", () => {
  it("returns 401 when unauthenticated", async () => {
    const { client } = createSupabaseForJobApplicationsRoute({
      userId: null,
      job,
      cvByJob: { overall_score: 90 },
      cvByCategory: null,
      interviewByJob: { score: 88, report: interviewReport },
      interviewByCategory: null,
      profileGuard: "complete",
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/job-applications", {
      method: "POST",
      body: JSON.stringify({ jobId: job.id }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when profile/CV guard blocks apply", async () => {
    const { client } = createSupabaseForJobApplicationsRoute({
      userId: "user-1",
      job,
      cvByJob: { overall_score: 90 },
      cvByCategory: null,
      interviewByJob: { score: 88, report: interviewReport },
      interviewByCategory: null,
      profileGuard: "no_cv",
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/job-applications", {
      method: "POST",
      body: JSON.stringify({ jobId: job.id }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when mock interview is missing (server-side lookup)", async () => {
    const { client } = createSupabaseForJobApplicationsRoute({
      userId: "user-1",
      job,
      cvByJob: { overall_score: 90 },
      cvByCategory: null,
      interviewByJob: null,
      interviewByCategory: null,
      profileGuard: "complete",
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/job-applications", {
      method: "POST",
      body: JSON.stringify({ jobId: job.id }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/mock interview/i);
  });

  it("returns 403 when CV analysis is missing for the role", async () => {
    const { client } = createSupabaseForJobApplicationsRoute({
      userId: "user-1",
      job,
      cvByJob: null,
      cvByCategory: null,
      interviewByJob: { score: 88, report: interviewReport },
      interviewByCategory: null,
      profileGuard: "complete",
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/job-applications", {
      method: "POST",
      body: JSON.stringify({ jobId: job.id }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when latest CV score from DB is below job minimum (server-enforced)", async () => {
    const { client } = createSupabaseForJobApplicationsRoute({
      userId: "user-1",
      job: { ...job, min_cv_score: 90 },
      cvByJob: { overall_score: 40 },
      cvByCategory: null,
      interviewByJob: { score: 95, report: interviewReport },
      interviewByCategory: null,
      profileGuard: "complete",
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/job-applications", {
      method: "POST",
      body: JSON.stringify({ jobId: job.id }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(String(body.error)).toMatch(/below the job minimum/i);
  });

  it("upserts DB-derived cv_score and interview_score (body is only jobId)", async () => {
    const dbCv = 88;
    const dbInterview = 91;
    const { client, upsertMock } = createSupabaseForJobApplicationsRoute({
      userId: "user-1",
      job,
      cvByJob: { overall_score: dbCv },
      cvByCategory: null,
      interviewByJob: { score: dbInterview, report: interviewReport },
      interviewByCategory: null,
      profileGuard: "complete",
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/job-applications", {
      method: "POST",
      body: JSON.stringify({ jobId: job.id }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const payload = upsertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.cv_score).toBe(dbCv);
    expect(payload.interview_score).toBe(dbInterview);
    expect(payload.interview_report).toMatchObject({
      strengths: ["clear"],
      improvements: ["depth"],
      technical_score: 81,
      communication_score: 79,
      problem_solving_score: 77,
    });
  });

  it("accepts authenticated candidate with complete profile, CV, and interview", async () => {
    const { client, upsertMock } = createSupabaseForJobApplicationsRoute({
      userId: "user-1",
      job,
      cvByJob: { overall_score: 70 },
      cvByCategory: null,
      interviewByJob: { score: 72, report: { strengths: [], improvements: [] } },
      interviewByCategory: null,
      profileGuard: "complete",
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/job-applications", {
      method: "POST",
      body: JSON.stringify({ jobId: job.id }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(upsertMock).toHaveBeenCalled();
  });
});
