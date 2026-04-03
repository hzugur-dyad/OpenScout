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
                  question_evaluations: [
                    {
                      question_id: "q1",
                      answered: true,
                      label: "strong",
                      score: 8,
                      competencies: {
                        technical_knowledge: 9,
                        problem_solving: 8,
                        communication: 8,
                        system_design: 7,
                        tradeoff_awareness: 8,
                      },
                      reason: "The candidate explained cache invalidation trade-offs with concrete failure cases.",
                    },
                    {
                      question_id: "q2",
                      answered: true,
                      label: "strong",
                      score: 8,
                      competencies: {
                        technical_knowledge: 8,
                        problem_solving: 8,
                        communication: 7,
                        system_design: 7,
                        tradeoff_awareness: 8,
                      },
                      reason: "They broke the outage response into triage, mitigation, rollback, and verification.",
                    },
                    {
                      question_id: "q3",
                      answered: true,
                      label: "medium",
                      score: 7,
                      competencies: {
                        technical_knowledge: 8,
                        problem_solving: 9,
                        communication: 8,
                        system_design: 8,
                        tradeoff_awareness: 7,
                      },
                      reason: "The scaling answer was mostly solid, but some observability detail stayed thin.",
                    },
                    {
                      question_id: "q4",
                      answered: true,
                      label: "medium",
                      score: 7,
                      competencies: {
                        technical_knowledge: 9,
                        problem_solving: 8,
                        communication: 8,
                        system_design: 7,
                        tradeoff_awareness: 8,
                      },
                      reason: "They compared rollout safety, latency risk, and operational impact before choosing a path.",
                    },
                  ],
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

  it("forces hallucinated scoring down to zero when the transcript has no usable evidence", async () => {
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
    expect(json.confidence).toBe("low");
    expect(json.is_preliminary).toBe(true);
    expect(json.final_score).toBe(0);
    expect(json.hire_recommendation).toBe("strong_no");
    expect(json.technical_score).toBe(0);
    expect(json.categories.technical_knowledge.score).toBe(0);
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

  it("persists deterministic scoring fields and compatibility aliases", async () => {
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
    expect(json.score).toBe(81);
    expect(json.final_score).toBe(81);
    expect(json.confidence).toBe("high");
    expect(json.coverage_score).toBe(93);
    expect(json.is_preliminary).toBe(false);
    expect(json.hire_recommendation).toBe("yes");
    expect(json.competency_breakdown).toEqual({
      technical_knowledge: 85,
      problem_solving: 83,
      communication: 78,
      system_design: 73,
      tradeoff_awareness: 78,
    });
    expect(json.categories.technical_knowledge.score).toBe(9);
    expect(json.question_evaluations[0].label).toBe("strong");
    expect(json.answer_breakdown[0].result).toBe("strong");
    expect(json.technical_score).toBe(85);
    expect(json.communication_score).toBe(78);
    expect(json.problem_solving_score).toBe(83);

    expect(insertMock).toHaveBeenCalledTimes(1);
    const row = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(row.transcript).toBe(transcript);
    expect(row.interview_language).toBe("tr");
    expect(row.model_version).toBe(GROQ_MOCK_INTERVIEW_MODEL);
    expect(row.prompt_version).toBe(MOCK_INTERVIEW_PIPELINE_VERSION);
    expect(row.score).toBe(81);
    expect(row.report).toMatchObject({
      final_score: 81,
      confidence: "high",
      coverage_score: 93,
      is_preliminary: false,
      competency_breakdown: {
        technical_knowledge: 85,
        problem_solving: 83,
      },
      categories: {
        technical_knowledge: { score: 9 },
        problem_solving: { score: 8 },
      },
      technical_score: 85,
      communication_score: 78,
      problem_solving_score: 83,
      hire_recommendation: "yes",
      evaluation_meta: {
        used_fallback: false,
        transcript_signal: "normal",
        transcript_signal_strength: "strong",
        total_questions: 4,
        answered_questions: 4,
        usable_answer_count: 4,
        competencies_covered_count: 5,
        confidence: "high",
        coverage_score: 93,
        is_preliminary: false,
        source: "post_interview_evaluation",
        pipeline_version: MOCK_INTERVIEW_PIPELINE_VERSION,
      },
    });
    const report = row.report as {
      question_evaluations?: Array<Record<string, unknown>>;
      answer_breakdown?: Array<Record<string, unknown>>;
    };
    expect(report.question_evaluations?.[0]).toMatchObject({
      question_id: "q1",
      answered: true,
      label: "strong",
      score: 8,
    });
    expect(report.answer_breakdown?.[0]).toMatchObject({
      question_id: "q1",
      result: "strong",
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

  it("returns zero for an interview with no answered questions", async () => {
    const createMock = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              question_evaluations: [
                {
                  question_id: "q1",
                  answered: false,
                  label: "no_response",
                  score: 0,
                  competencies: {
                    technical_knowledge: 0,
                    problem_solving: 0,
                    communication: 0,
                    system_design: 0,
                    tradeoff_awareness: 0,
                  },
                  reason: "The candidate never answered the first question.",
                },
                {
                  question_id: "q2",
                  answered: false,
                  label: "no_response",
                  score: 0,
                  competencies: {
                    technical_knowledge: 0,
                    problem_solving: 0,
                    communication: 0,
                    system_design: 0,
                    tradeoff_awareness: 0,
                  },
                  reason: "The candidate never answered the second question.",
                },
              ],
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
      "assistant: Tell me about a production incident you handled.",
      `user: ${INTERVIEW_CONTRACT_USER_LINES.en.timeout}`,
      "assistant: How do you approach cache invalidation?",
      `user: ${INTERVIEW_CONTRACT_USER_LINES.en.timeout}`,
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
    const json = await res.json();
    expect(json.final_score).toBe(0);
    expect(json.confidence).toBe("low");
    expect(json.is_preliminary).toBe(true);
    expect(json.hire_recommendation).toBe("strong_no");
    expect(json.categories.technical_knowledge.score).toBe(0);
    expect(json.technical_score).toBe(0);
  });

  it("keeps parser fallback results in the 0-10 band instead of inventing a neutral score", async () => {
    vi.mocked(getGroq).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: "not valid json",
                },
              },
            ],
          }),
        },
      },
    } as never);

    const { client } = createSupabaseForMockInterviewResultRoute({
      userId: "user-1",
      profileGuard: "complete",
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/mock-interview/result", {
      method: "POST",
      body: JSON.stringify({
        sessionId: testSessionId,
        transcript: qualifyingInterviewTranscript,
        jobCategory: "Engineering",
        interviewLanguage: "en",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.evaluation_used_fallback).toBe(true);
    expect(json.final_score).toBeLessThanOrEqual(10);
    expect(json.confidence).toBe("low");
    expect(json.is_preliminary).toBe(true);
    expect(json.hire_recommendation).toBe("strong_no");
  });

  it("passes unanswered/no_response markers through to the evaluation payload", async () => {
    const createMock = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              question_evaluations: [
                {
                  question_id: "q1",
                  answered: true,
                  label: "medium",
                  score: 6,
                  competencies: {
                    technical_knowledge: 6,
                    problem_solving: 6,
                    communication: 6,
                    system_design: 4,
                    tradeoff_awareness: 5,
                  },
                  reason: "Reasonable outage process, but not deeply detailed.",
                },
                {
                  question_id: "q2",
                  answered: false,
                  label: "no_response",
                  score: 0,
                  competencies: {
                    technical_knowledge: 0,
                    problem_solving: 0,
                    communication: 0,
                    system_design: 0,
                    tradeoff_awareness: 0,
                  },
                  reason: "The candidate did not answer the cache stampede question.",
                },
              ],
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
    const json = await res.json();
    expect(json.question_evaluations[1].label).toBe("no_response");
    expect(json.final_score).toBe(19);
    expect(json.confidence).toBe("low");
    expect(json.is_preliminary).toBe(true);
    expect(json.hire_recommendation).toBe("strong_no");

    expect(createMock).toHaveBeenCalledTimes(1);
    const groqPayload = createMock.mock.calls[0]?.[0] as {
      temperature?: number;
      messages?: Array<{ role: string; content: string }>;
    };
    expect(groqPayload.temperature).toBe(0);
    expect(groqPayload.messages?.[1]?.content).toContain("answered=false, label=no_response");
  });
});
