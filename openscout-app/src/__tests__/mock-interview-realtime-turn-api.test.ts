import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/mock-interview/realtime/turn/route";
import { createClient } from "@/lib/supabase/server";
import { generateInterviewTurnPlan } from "@/services/ai";
import { createSupabaseForMockInterviewRealtimeRoute } from "@/test/supabase-mocks";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/services/ai", () => ({
  generateInterviewTurnPlan: vi.fn(),
}));

describe("POST /api/mock-interview/realtime/turn", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    vi.mocked(generateInterviewTurnPlan).mockReset();
    vi.mocked(generateInterviewTurnPlan).mockResolvedValue({
      plannerAction: "advance",
      spokenText: "Tell me about the toughest production incident you handled.",
      nextQuestion: "Tell me about the toughest production incident you handled.",
      followUp: null,
      assessmentFocus: "incident ownership and debugging depth",
      evaluationHint: "Look for concrete steps, metrics, and trade-offs.",
      difficulty: "hard",
      isOffTopic: false,
      questionSource: "custom",
      closingLine: null,
      control: {
        questionId: "q_01_custom",
        attempt: 1,
        isFollowup: false,
        shouldEnd: false,
        endReason: null,
      },
      speechInstructions: "SERVER ORCHESTRATOR: ...",
    } as never);
  });

  it("passes job context and employer custom questions to the planner and returns the planned turn", async () => {
    const { client } = createSupabaseForMockInterviewRealtimeRoute({
      userId: "user-1",
      profileGuard: "complete",
      jobRow: {
        title: "Senior Backend Engineer",
        description: "Design and run distributed APIs.",
        requirements: "Strong debugging, caching, and incident response.",
        ai_interview_config: {
          custom_questions: [
            "Tell me about the toughest production incident you handled.",
            "Explain how you approach cache invalidation.",
          ],
        },
      },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/mock-interview/realtime/turn", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "session-1",
        jobCategory: "Engineering",
        userName: "Taylor",
        jobId: "job-1",
        interviewLanguage: "en",
        transcript: [
          { role: "assistant", content: "Welcome to the interview." },
          { role: "user", content: "Thank you." },
        ],
        currentControl: {
          questionId: "q_00_opening",
          attempt: 1,
          isFollowup: false,
        },
        questionHistory: [
          {
            questionId: "q_00_opening",
            prompt: "Welcome to the interview.",
            source: "generated",
            difficulty: "easy",
          },
        ],
        lastUserMessage: "Thank you.",
        turnKind: "voice_turn",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toMatchObject({
      nextQuestion: "Tell me about the toughest production incident you handled.",
      questionSource: "custom",
      speechInstructions: "SERVER ORCHESTRATOR: ...",
      control: {
        questionId: "q_01_custom",
        attempt: 1,
        isFollowup: false,
        shouldEnd: false,
        endReason: null,
      },
    });

    expect(generateInterviewTurnPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "en",
        displayName: "Taylor",
        lastUserMessage: "Thank you.",
        turnKind: "voice_turn",
        currentControl: {
          questionId: "q_00_opening",
          attempt: 1,
          isFollowup: false,
        },
        jobContext: {
          role: "Senior Backend Engineer",
          description: "Design and run distributed APIs.",
          requirements: "Strong debugging, caching, and incident response.",
          customQuestions: [
            "Tell me about the toughest production incident you handled.",
            "Explain how you approach cache invalidation.",
          ],
        },
      })
    );
  });
});
