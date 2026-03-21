import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/mock-interview/result/route";
import { createClient } from "@/lib/supabase/server";
import { getGroq } from "@/lib/groq";
import { createSupabaseForMockInterviewResultRoute } from "@/test/supabase-mocks";
import { GROQ_MOCK_INTERVIEW_MODEL, MOCK_INTERVIEW_PIPELINE_VERSION } from "@/lib/mock-interview/versioning";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/groq", () => ({
  getGroq: vi.fn(),
}));

vi.mock("@/lib/usage", () => ({
  getUserPlan: vi.fn(() => "pro"),
  canUseFeature: vi.fn(async () => ({ allowed: true, used: 0, limit: 999 })),
  logUsage: vi.fn(async () => {}),
}));

vi.mock("@/lib/referral-rewards", () => ({
  REFERRAL_QUALIFYING_TRANSCRIPT_MIN_CHARS: 400,
  tryCompleteReferralRewardForUser: vi.fn(async () => {}),
}));

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(getGroq).mockReset();
  vi.mocked(getGroq).mockReturnValue({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  score: 82,
                  strengths: ["Structured answers"],
                  improvements: ["More examples"],
                  technical_score: 80,
                  communication_score: 78,
                  problem_solving_score: 76,
                  justification: "Solid performance.",
                }),
              },
            },
          ],
        }),
      },
    },
  } as never);
});

const longTranscript = "x".repeat(400);

describe("POST /api/mock-interview/result", () => {
  it("returns 401 when unauthenticated", async () => {
    const { client } = createSupabaseForMockInterviewResultRoute({
      userId: null,
      profileGuard: "complete",
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/mock-interview/result", {
      method: "POST",
      body: JSON.stringify({
        transcript: "Hello",
        jobCategory: "Engineering",
        interviewLanguage: "en",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when transcript is shorter than qualifying minimum", async () => {
    const { client } = createSupabaseForMockInterviewResultRoute({
      userId: "user-1",
      profileGuard: "complete",
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/mock-interview/result", {
      method: "POST",
      body: JSON.stringify({
        transcript: "short",
        jobCategory: "Engineering",
        interviewLanguage: "en",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 403 when profile/CV guard blocks interview results", async () => {
    const { client } = createSupabaseForMockInterviewResultRoute({
      userId: "user-1",
      profileGuard: "blocked",
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/mock-interview/result", {
      method: "POST",
      body: JSON.stringify({
        transcript: "Hello",
        jobCategory: "Engineering",
        interviewLanguage: "en",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("persists transcript, locale, model_version, prompt_version and normalized scores (Groq mocked)", async () => {
    const transcript = longTranscript;
    const { client, insertMock } = createSupabaseForMockInterviewResultRoute({
      userId: "user-1",
      profileGuard: "complete",
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/mock-interview/result", {
      method: "POST",
      body: JSON.stringify({
        transcript,
        jobCategory: "Engineering",
        jobId: "job-xyz",
        interviewLanguage: "tr",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.score).toBe(82);
    expect(json.strengths).toContain("Structured answers");

    expect(insertMock).toHaveBeenCalledTimes(1);
    const row = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(row.transcript).toBe(transcript);
    expect(row.interview_language).toBe("tr");
    expect(row.model_version).toBe(GROQ_MOCK_INTERVIEW_MODEL);
    expect(row.prompt_version).toBe(MOCK_INTERVIEW_PIPELINE_VERSION);
    expect(row.score).toBe(82);
    expect(row.report).toMatchObject({
      strengths: ["Structured answers"],
      improvements: ["More examples"],
      technical_score: 80,
      communication_score: 78,
      problem_solving_score: 76,
    });
    expect(row.user_id).toBe("user-1");
    expect(row.job_id).toBe("job-xyz");
    expect(row.job_category).toBe("Engineering");
  });

  it("accepts authenticated user with complete profile for happy-path authorization", async () => {
    const { client } = createSupabaseForMockInterviewResultRoute({
      userId: "user-1",
      profileGuard: "complete",
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/mock-interview/result", {
      method: "POST",
      body: JSON.stringify({
        transcript: longTranscript,
        jobCategory: "Design",
        interviewLanguage: "en",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
