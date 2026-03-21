import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as postManualCv } from "@/app/api/cv-analysis/route";
import { POST as postAutoCv } from "@/app/api/cv-analysis/auto/route";
import { createClient } from "@/lib/supabase/server";
import { getGroq } from "@/lib/groq";
import * as usage from "@/lib/usage";
import {
  createSupabaseForAutoCvAnalysis,
  createSupabaseForManualCvAnalysis,
} from "@/test/supabase-mocks";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/groq", () => ({
  getGroq: vi.fn(),
}));

vi.mock("@/lib/usage", () => ({
  getUserPlan: vi.fn((plan: string | undefined) => (plan === "pro" ? "pro" : "free")),
  canUseFeature: vi.fn(),
  logUsage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("pdf-parse", () => ({
  default: vi.fn().mockResolvedValue({ text: "parsed pdf ".repeat(30) }),
}));

const VALID_MODEL_JSON = {
  cv_holder: {
    full_name: "Candidate",
    current_role: "Dev",
    department_or_field: "Eng",
    location: "EU",
    email: "on-cv@example.com",
    summary_line: "Summary",
  },
  category_scores: {
    professional_summary: 82,
    work_experience: 81,
    skills: 80,
    education: 79,
    online_presence: 78,
    highlights: 77,
  },
  category_feedback: {},
  detailed_report: "Report text.",
  strengths: ["Clear structure"],
  improvements: ["Quantify impact"],
};

function groqSuccess() {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(VALID_MODEL_JSON) } }],
        }),
      },
    },
  } as never;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(getGroq).mockReset();
  vi.mocked(getGroq).mockReturnValue(groqSuccess());
  vi.mocked(usage.canUseFeature).mockResolvedValue({ allowed: true, used: 0, limit: 5 });
});

describe("POST /api/cv-analysis", () => {
  it("returns 401 when unauthenticated", async () => {
    const insertCv = vi.fn();
    const client = createSupabaseForManualCvAnalysis({
      userId: null,
      profilePlan: "free",
      insertCvMock: insertCv,
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/cv-analysis", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cvText: "1234567890 enough chars for schema",
        jobCategory: "Backend",
      }),
    });
    const res = await postManualCv(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    const insertCv = vi.fn();
    const client = createSupabaseForManualCvAnalysis({
      userId: "u-1",
      profilePlan: "pro",
      insertCvMock: insertCv,
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/cv-analysis", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    const res = await postManualCv(req);
    expect(res.status).toBe(400);
  });

  it("returns 403 when weekly CV usage limit is exceeded", async () => {
    vi.mocked(usage.canUseFeature).mockResolvedValueOnce({
      allowed: false,
      used: 5,
      limit: 5,
    });
    const insertCv = vi.fn();
    const client = createSupabaseForManualCvAnalysis({
      userId: "u-1",
      profilePlan: "free",
      insertCvMock: insertCv,
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/cv-analysis", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cvText: "1234567890 enough chars for schema",
        jobCategory: "Backend",
      }),
    });
    const res = await postManualCv(req);
    expect(res.status).toBe(403);
    expect(insertCv).not.toHaveBeenCalled();
  });

  it("returns 400 when multipart file type is not allowed", async () => {
    const insertCv = vi.fn();
    const client = createSupabaseForManualCvAnalysis({
      userId: "u-1",
      profilePlan: "pro",
      insertCvMock: insertCv,
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const fd = new FormData();
    fd.append("jobCategory", "Backend");
    fd.append("file", new File(["x"], "cv.docx", { type: "application/vnd.fake" }));

    const req = new NextRequest("http://localhost/api/cv-analysis", {
      method: "POST",
      body: fd,
    });
    const res = await postManualCv(req);
    expect(res.status).toBe(400);
    expect(insertCv).not.toHaveBeenCalled();
  });

  it("returns 500 with safe message when Groq fails", async () => {
    vi.mocked(getGroq).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error("rate limit exceeded")),
        },
      },
    } as never);

    const insertCv = vi.fn();
    const client = createSupabaseForManualCvAnalysis({
      userId: "u-1",
      profilePlan: "pro",
      insertCvMock: insertCv,
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/cv-analysis", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cvText: "1234567890 enough chars for schema",
        jobCategory: "Backend",
      }),
    });
    const res = await postManualCv(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("rate limit exceeded");
    expect(insertCv).not.toHaveBeenCalled();
  });

  it("parses model output, inserts normalized row, returns JSON without usedFallback", async () => {
    const insertCv = vi.fn();
    const client = createSupabaseForManualCvAnalysis({
      userId: "u-1",
      profilePlan: "pro",
      insertCvMock: insertCv,
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/cv-analysis", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cvText: "1234567890 enough chars for schema",
        jobCategory: "Platform Engineering",
      }),
    });
    const res = await postManualCv(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.usedFallback).toBeUndefined();
    expect(body.overall_score).toBeTypeOf("number");
    expect(body.strengths).toContain("Clear structure");

    expect(insertCv).toHaveBeenCalledTimes(1);
    const row = insertCv.mock.calls[0][0] as Record<string, unknown>;
    expect(row.user_id).toBe("u-1");
    expect(row.job_category).toBe("Platform Engineering");
    expect(row.strengths).toEqual(["Clear structure"]);
    expect(row.improvements).toEqual(["Quantify impact"]);
    expect(row.overall_score).toBe(body.overall_score);
    expect(row.category_scores).toBeTruthy();
  });

  it("includes job_id in insert when jobId is provided (job listing mocked)", async () => {
    const insertCv = vi.fn();
    const client = createSupabaseForManualCvAnalysis({
      userId: "u-1",
      profilePlan: "pro",
      insertCvMock: insertCv,
      jobListingRow: { ai_interview_config: { cv_required_items: ["Kubernetes"] } },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/cv-analysis", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cvText: "1234567890 enough chars for schema with Kubernetes experience",
        jobCategory: "SRE",
        jobId: "job-99",
      }),
    });
    const res = await postManualCv(req);
    expect(res.status).toBe(200);
    expect(insertCv).toHaveBeenCalled();
    const row = insertCv.mock.calls[0][0] as Record<string, unknown>;
    expect(row.job_id).toBe("job-99");
    expect(row.job_category).toBe("SRE");
  });
});

describe("POST /api/cv-analysis/auto", () => {
  it("returns 401 when unauthenticated", async () => {
    const client = createSupabaseForAutoCvAnalysis({
      userId: null,
      existingAnalysis: null,
      privateRow: { cv_raw_text: "x".repeat(20) },
      jobRow: { title: "Role", company_id: "co-1" },
      insertCvMock: vi.fn(),
      insertEmployerUsageMock: vi.fn(),
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/cv-analysis/auto", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: "job-1" }),
    });
    const res = await postAutoCv(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when jobId is missing", async () => {
    const client = createSupabaseForAutoCvAnalysis({
      userId: "u-1",
      existingAnalysis: null,
      privateRow: { cv_raw_text: "x".repeat(20) },
      jobRow: { title: "Role", company_id: "co-1" },
      insertCvMock: vi.fn(),
      insertEmployerUsageMock: vi.fn(),
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/cv-analysis/auto", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await postAutoCv(req);
    expect(res.status).toBe(400);
  });

  it("returns cached score without calling Groq when analysis already exists", async () => {
    const groqCreate = vi.fn();
    vi.mocked(getGroq).mockReturnValue({
      chat: { completions: { create: groqCreate } },
    } as never);

    const insertCv = vi.fn();
    const insertUsage = vi.fn();
    const client = createSupabaseForAutoCvAnalysis({
      userId: "u-1",
      existingAnalysis: { overall_score: 73 },
      privateRow: { cv_raw_text: "x".repeat(20) },
      jobRow: { title: "Role", company_id: "co-1" },
      insertCvMock: insertCv,
      insertEmployerUsageMock: insertUsage,
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/cv-analysis/auto", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: "job-1" }),
    });
    const res = await postAutoCv(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ overall_score: 73, cached: true });
    expect(groqCreate).not.toHaveBeenCalled();
    expect(insertCv).not.toHaveBeenCalled();
  });

  it("returns 404 when job is missing", async () => {
    const client = createSupabaseForAutoCvAnalysis({
      userId: "u-1",
      existingAnalysis: null,
      privateRow: { cv_raw_text: "x".repeat(20) },
      jobRow: null,
      insertCvMock: vi.fn(),
      insertEmployerUsageMock: vi.fn(),
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/cv-analysis/auto", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: "missing-job" }),
    });
    const res = await postAutoCv(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 when no CV text is available", async () => {
    const client = createSupabaseForAutoCvAnalysis({
      userId: "u-1",
      existingAnalysis: null,
      privateRow: { cv_raw_text: "" },
      jobRow: { title: "Role", company_id: "co-1" },
      insertCvMock: vi.fn(),
      insertEmployerUsageMock: vi.fn(),
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/cv-analysis/auto", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: "job-1" }),
    });
    const res = await postAutoCv(req);
    expect(res.status).toBe(400);
  });

  it("returns generic 500 on Groq failure (no stack trace in body)", async () => {
    vi.mocked(getGroq).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error("internal groq detail xyz")),
        },
      },
    } as never);

    const insertCv = vi.fn();
    const insertUsage = vi.fn();
    const client = createSupabaseForAutoCvAnalysis({
      userId: "u-1",
      existingAnalysis: null,
      privateRow: { cv_raw_text: "x".repeat(20) },
      jobRow: { title: "Role", company_id: "co-1" },
      insertCvMock: insertCv,
      insertEmployerUsageMock: insertUsage,
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/cv-analysis/auto", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: "job-1" }),
    });
    const res = await postAutoCv(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Analysis failed");
    expect(JSON.stringify(body)).not.toMatch(/internal groq detail/i);
  });

  it("inserts cv_analyses and employer_usage_logs on success", async () => {
    const insertCv = vi.fn();
    const insertUsage = vi.fn();
    const client = createSupabaseForAutoCvAnalysis({
      userId: "u-1",
      existingAnalysis: null,
      privateRow: { cv_raw_text: "x".repeat(20) },
      jobRow: { title: "SRE", company_id: "co-99" },
      insertCvMock: insertCv,
      insertEmployerUsageMock: insertUsage,
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/cv-analysis/auto", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: "job-1" }),
    });
    const res = await postAutoCv(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ cached: false });

    expect(insertCv).toHaveBeenCalledTimes(1);
    const row = insertCv.mock.calls[0][0] as Record<string, unknown>;
    expect(row.user_id).toBe("u-1");
    expect(row.job_id).toBe("job-1");
    expect(row.job_category).toBe("SRE");
    expect(row.overall_score).toBeTypeOf("number");

    expect(insertUsage.mock.calls[0][0]).toMatchObject({
      company_id: "co-99",
      feature: "auto_cv_analysis",
    });
  });
});
