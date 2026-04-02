import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/mock-interview/result/route";
import { createClient } from "@/lib/supabase/server";
import { getGroq } from "@/lib/groq";
import { createSupabaseForMockInterviewResultRoute } from "@/test/supabase-mocks";
import { GROQ_MOCK_INTERVIEW_MODEL, MOCK_INTERVIEW_PIPELINE_VERSION } from "@/lib/mock-interview/versioning";
import { INTERVIEW_CONTRACT_USER_LINES } from "@/lib/mock-interview/interview-contract-messages";

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
                  final_score: 82,
                  categories: {
                    technical_knowledge: {
                      score: 9,
                      reason: "Strong command of backend mechanisms and failure handling.",
                    },
                    problem_solving: {
                      score: 8,
                      reason: "Structured debugging and prioritization under pressure.",
                    },
                    system_design: {
                      score: 8,
                      reason: "Good architecture choices with some operational detail.",
                    },
                    communication: {
                      score: 8,
                      reason: "Answers were clear, organized, and concise.",
                    },
                    tradeoffs: {
                      score: 8,
                      reason: "Trade-offs were explicit instead of generic.",
                    },
                    practical_experience: {
                      score: 7,
                      reason: "Examples sounded grounded in production work.",
                    },
                  },
                  answer_breakdown: [
                    {
                      question_id: "q1",
                      result: "strong",
                      reason: "Strong cache and invalidation reasoning.",
                    },
                  ],
                  strengths: ["Structured answers"],
                  weaknesses: ["Use more concrete rollout examples"],
                  hire_recommendation: "yes",
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

  it("accepts short transcripts and still returns an evaluation", async () => {
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
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.score).toBe("number");
    expect(typeof json.final_score).toBe("number");
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
    expect(json.score).toBe(82);
    expect(json.final_score).toBe(82);
    expect(json.strengths).toContain("Structured answers");
    expect(json.hire_recommendation).toBe("yes");
    expect(json.categories.technical_knowledge.score).toBe(9);
    expect(json.answer_breakdown[0].result).toBe("strong");

    expect(insertMock).toHaveBeenCalledTimes(1);
    const row = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(row.transcript).toBe(transcript);
    expect(row.interview_language).toBe("tr");
    expect(row.model_version).toBe(GROQ_MOCK_INTERVIEW_MODEL);
    expect(row.prompt_version).toBe(MOCK_INTERVIEW_PIPELINE_VERSION);
    expect(row.score).toBe(82);
    expect(row.report).toMatchObject({
      final_score: 82,
      categories: {
        technical_knowledge: { score: 9 },
        problem_solving: { score: 8 },
      },
      answer_breakdown: [
        {
          question_id: "q1",
          result: "strong",
        },
      ],
      strengths: ["Structured answers"],
      improvements: ["Use more concrete rollout examples"],
      technical_score: 90,
      communication_score: 80,
      problem_solving_score: 80,
      hire_recommendation: "yes",
      evaluation_meta: {
        used_fallback: false,
        transcript_signal: "normal",
        source: "post_interview_evaluation",
        pipeline_version: MOCK_INTERVIEW_PIPELINE_VERSION,
      },
    });
    expect(row.user_id).toBe("user-1");
    expect(row.job_id).toBe("job-xyz");
    expect(row.job_category).toBe("Engineering");
    expect(row.id).toBe(testSessionId);
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

  it("passes unanswered/no_response markers through to the evaluation payload", async () => {
    const createMock = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              final_score: 56,
              categories: {
                technical_knowledge: {
                  score: 6,
                  reason: "Some correct debugging ideas, but depth weakened after the missed answer.",
                },
                problem_solving: {
                  score: 6,
                  reason: "The response structure was workable, but signal dropped on unanswered questions.",
                },
                system_design: {
                  score: 5,
                  reason: "Limited architecture evidence in this transcript.",
                },
                communication: {
                  score: 6,
                  reason: "Most answers were understandable and direct.",
                },
                tradeoffs: {
                  score: 5,
                  reason: "Trade-off depth was inconsistent.",
                },
                practical_experience: {
                  score: 4,
                  reason: "Limited hands-on signal because one topic was not answered.",
                },
              },
              answer_breakdown: [
                {
                  question_id: "q1",
                  result: "medium",
                  reason: "Reasonable outage process, but not deeply detailed.",
                },
                {
                  question_id: "q2",
                  result: "no_response",
                  reason: "The candidate did not answer the cache stampede question.",
                },
              ],
              strengths: ["Concise"],
              weaknesses: ["Answer more questions directly"],
              hire_recommendation: "no",
            }),
          },
        },
      ],
    });
    vi.mocked(getGroq).mockReturnValue({
      chat: {
        completions: {
          create: createMock,
        },
      },
    } as never);

    const transcript = [
      "assistant: Tell me about a production outage you handled.",
      "user: I would start by checking logs and rollout history before isolating the failing dependency.",
      "assistant: How would you debug a cache stampede?",
      `user: ${INTERVIEW_CONTRACT_USER_LINES.en.timeout}`,
      "assistant: What metrics would you watch during recovery?",
      "user: Error rate, p95 latency, saturation, and downstream dependency health so we can tell whether the rollback actually stabilizes the system.",
      "assistant: How do you document the follow-up?",
      "user: I would write the timeline, root cause, customer impact, mitigations, and preventive actions with owners and due dates.",
    ].join("\n");

    const { client } = createSupabaseForMockInterviewResultRoute({
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
        interviewLanguage: "en",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(createMock).toHaveBeenCalledTimes(1);
    const groqPayload = createMock.mock.calls[0]?.[0] as {
      temperature?: number;
      messages?: Array<{ role: string; content: string }>;
    };
    expect(groqPayload.temperature).toBe(0);
    expect(groqPayload.messages?.[1]?.content).toContain("unanswered/no_response");
  });
});
