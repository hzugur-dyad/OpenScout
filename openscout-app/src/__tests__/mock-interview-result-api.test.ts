import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/mock-interview/result/route";
import { createClient } from "@/lib/supabase/server";
import { getGroq } from "@/lib/groq";
import { computeDeterministicInterviewOverallScore, MOCK_INTERVIEW_POLICY_VERSION } from "@/lib/mock-interview/policy";
import { createSupabaseForMockInterviewResultRoute } from "@/test/supabase-mocks";
import {
  GROQ_MOCK_INTERVIEW_SCORING_MODEL,
  GROQ_MOCK_INTERVIEW_THINKING_MODEL,
  MOCK_INTERVIEW_PIPELINE_VERSION,
} from "@/lib/mock-interview/versioning";

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

const createCompletionMock = vi.fn();

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(getGroq).mockReset();
  createCompletionMock.mockReset();
  createCompletionMock.mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            verdict: "hire",
            strengths: ["Structured answers"],
            improvements: ["More examples"],
            technical_score: 84,
            communication_score: 78,
            problem_solving_score: 80,
            role_fit_score: 84,
            evidence_quality: "high",
            justification: "Solid performance.",
          }),
        },
      },
    ],
  });
  vi.mocked(getGroq).mockReturnValue({
    chat: {
      completions: {
        create: createCompletionMock,
      },
    },
  } as never);
});

const longTranscript = "x".repeat(400);

/** Qualifying length + realistic dialogue so transcript-quality heuristics stay "normal" */
const qualifyingInterviewTranscript = [
  "assistant: How would you design caching for a read-heavy API?",
  "user: I would start with a short TTL CDN layer, then add an application cache with explicit invalidation on writes and monitor hit rate plus stale reads.",
  "assistant: What failure modes worry you most at scale?",
  "user: Thundering herd on cold keys, cache stampede, and inconsistent reads across regions; I would use request coalescing, jittered TTLs, and versioned keys where needed.",
  "assistant: Walk through debugging a latency regression.",
  "user: I would trace p95 by dependency, compare deployments, profile hot paths, and validate with canary metrics before rolling forward.",
  "assistant: How do you approach API versioning when mobile clients lag?",
  "user: I prefer additive changes with feature flags, sunset headers, and contract tests so older clients keep working while we migrate traffic gradually.",
].join("\n");
const testSessionId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

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
        sessionId: testSessionId,
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
        sessionId: testSessionId,
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
        sessionId: testSessionId,
        transcript: longTranscript,
        jobCategory: "Engineering",
        interviewLanguage: "en",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("persists transcript, locale, model_version, prompt_version and normalized scores (Groq mocked)", async () => {
    const transcript = qualifyingInterviewTranscript;
    const expectedScore = computeDeterministicInterviewOverallScore({
      technical: 84,
      problemSolving: 80,
      communication: 78,
      roleFit: 84,
    });
    const { client, insertMock } = createSupabaseForMockInterviewResultRoute({
      userId: "user-1",
      profileGuard: "complete",
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/mock-interview/result", {
      method: "POST",
      body: JSON.stringify({
        sessionId: testSessionId,
        transcript,
        jobCategory: "Engineering",
        jobId: "job-xyz",
        interviewLanguage: "tr",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.score).toBe(expectedScore);
    expect(json.strengths).toContain("Structured answers");

    expect(insertMock).toHaveBeenCalledTimes(1);
    const row = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(row.transcript).toBe(transcript);
    expect(row.interview_language).toBe("tr");
    expect(row.model_version).toBe(GROQ_MOCK_INTERVIEW_SCORING_MODEL);
    expect(row.prompt_version).toBe(MOCK_INTERVIEW_PIPELINE_VERSION);
    expect(row.score).toBe(expectedScore);
    expect(row.report).toMatchObject({
      strengths: ["Structured answers"],
      improvements: ["More examples"],
      technical_score: 84,
      communication_score: 78,
      problem_solving_score: 80,
      role_fit_score: 84,
      evidence_quality: "high",
      evaluation_meta: {
        used_fallback: false,
        transcript_signal: "normal",
        source: "post_interview_evaluation",
        pipeline_version: MOCK_INTERVIEW_PIPELINE_VERSION,
        planner_model: GROQ_MOCK_INTERVIEW_THINKING_MODEL,
        scoring_model: GROQ_MOCK_INTERVIEW_SCORING_MODEL,
        policy_version: MOCK_INTERVIEW_POLICY_VERSION,
        evidence_quality: "high",
      },
    });
    expect(row.user_id).toBe("user-1");
    expect(row.job_id).toBe("job-xyz");
    expect(row.job_category).toBe("Engineering");
    expect(row.id).toBe(testSessionId);
    expect(createCompletionMock).toHaveBeenCalledTimes(1);
    const scoringRequest = createCompletionMock.mock.calls[0]?.[0] as {
      messages?: Array<{ content?: string }>;
    };
    expect(scoringRequest.messages?.[0]?.content).toContain("strengths, weaknesses, and summary must all be in English.");
    expect(scoringRequest.messages?.[0]?.content).not.toContain("Tum strengths, weaknesses ve summary");
  });

  it("caps the final overall score when the transcript signal is too weak", async () => {
    vi.mocked(getGroq).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    verdict: "strong hire",
                    strengths: ["Fast answers"],
                    weaknesses: ["Limited detail"],
                    technical: 96,
                    communication: 92,
                    problemSolving: 94,
                    roleFit: 90,
                    evidence_quality: "low",
                    summary: "The transcript quality is weak but the model response is still structured.",
                  }),
                },
              },
            ],
          }),
        },
      },
    } as never);

    const lowSignalTranscript = [
      "assistant: Describe the last severe incident you debugged in production and how you narrowed the root cause.",
      "user: yes",
      "assistant: Which metrics changed first and what hypothesis did that create for you?",
      "user: no",
      "assistant: Explain how you would roll back safely while preserving data integrity and customer experience.",
      "user: maybe",
      "assistant: What trade-offs would you accept between recovery speed and long-term correctness in that incident?",
      "user: okay",
    ].join("\n");

    const { client, insertMock } = createSupabaseForMockInterviewResultRoute({
      userId: "user-1",
      profileGuard: "complete",
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/mock-interview/result", {
      method: "POST",
      body: JSON.stringify({
        sessionId: testSessionId,
        transcript: lowSignalTranscript,
        jobCategory: "Engineering",
        interviewLanguage: "en",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.score).toBe(48);

    const row = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(row.score).toBe(48);
    expect(row.report).toMatchObject({
      evaluation_meta: {
        transcript_signal: "low",
        transcript_score_cap: 48,
        evidence_quality: "low",
      },
    });
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
        sessionId: testSessionId,
        transcript: longTranscript,
        jobCategory: "Design",
        interviewLanguage: "en",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
