import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateInterviewTurnPlan } from "@/services/ai";
import { createGroqJsonCompletion } from "@/services/groq";

vi.mock("@/services/groq", () => ({
  createGroqJsonCompletion: vi.fn(),
  getGroqScoringModel: vi.fn(() => "mock-scoring-model"),
  getGroqThinkingModel: vi.fn(() => "mock-thinking-model"),
}));

describe("generateInterviewTurnPlan", () => {
  beforeEach(() => {
    vi.mocked(createGroqJsonCompletion).mockReset();
  });

  it("keeps the same question thread for the first silence repeat", async () => {
    vi.mocked(createGroqJsonCompletion).mockResolvedValue(
      JSON.stringify({
        action: "follow_up",
        spokenPrompt: "I didn't catch that. Walk me through how you invalidate cache after a write.",
        nextQuestion: "Walk me through how you invalidate cache after a write.",
        followUp: "Walk me through how you invalidate cache after a write.",
        assessmentFocus: "cache invalidation clarity",
        evaluationHint: "Check whether they explain write-through vs write-behind trade-offs.",
        difficulty: "medium",
        isOffTopic: false,
        closingReason: null,
      })
    );

    const plan = await generateInterviewTurnPlan({
      locale: "en",
      displayName: "Taylor",
      transcript: [
        { role: "assistant", content: "Walk me through how you invalidate cache after a write." },
        { role: "user", content: "[User was silent or speech was not recognized. Ask them to repeat briefly.]" },
      ],
      jobContext: {
        role: "Backend Engineer",
        description: "Own caching and API performance.",
        requirements: "Strong distributed systems fundamentals.",
        customQuestions: [],
      },
      currentControl: {
        questionId: "q_01_generated",
        attempt: 1,
        isFollowup: false,
      },
      questionHistory: [
        {
          questionId: "q_01_generated",
          prompt: "Walk me through how you invalidate cache after a write.",
          source: "generated",
          difficulty: "medium",
        },
      ],
      lastUserMessage: "[User was silent or speech was not recognized. Ask them to repeat briefly.]",
      turnKind: "silence",
    });

    expect(plan.control).toEqual({
      questionId: "q_01_generated",
      attempt: 1,
      isFollowup: false,
      shouldEnd: false,
      endReason: null,
    });
    expect(plan.questionSource).toBe("generated");
    expect(plan.spokenText).toBe("I didn't catch that. Walk me through how you invalidate cache after a write.");
  });

  it("forces a new main question after silence escalation", async () => {
    vi.mocked(createGroqJsonCompletion).mockResolvedValue(
      JSON.stringify({
        action: "follow_up",
        spokenPrompt: "Can you clarify the cache invalidation flow?",
        nextQuestion: "What signals tell you a queue backlog is becoming a production incident?",
        followUp: "Can you clarify the cache invalidation flow?",
        assessmentFocus: "production signal quality",
        evaluationHint: "Look for concrete thresholds, alerts, and escalation logic.",
        difficulty: "hard",
        isOffTopic: false,
        closingReason: null,
      })
    );

    const plan = await generateInterviewTurnPlan({
      locale: "en",
      displayName: "Taylor",
      transcript: [
        { role: "assistant", content: "Walk me through how you invalidate cache after a write." },
        { role: "user", content: "[User remained silent again after a repeat prompt. Do not re-ask the same wording. Acknowledge briefly and move to the next topic with a new question_id and attempt=1.]" },
      ],
      jobContext: {
        role: "Backend Engineer",
        description: "Own caching and API performance.",
        requirements: "Strong distributed systems fundamentals.",
        customQuestions: [],
      },
      currentControl: {
        questionId: "q_01_generated",
        attempt: 1,
        isFollowup: false,
      },
      questionHistory: [
        {
          questionId: "q_01_generated",
          prompt: "Walk me through how you invalidate cache after a write.",
          source: "generated",
          difficulty: "medium",
        },
      ],
      lastUserMessage:
        "[User remained silent again after a repeat prompt. Do not re-ask the same wording. Acknowledge briefly and move to the next topic with a new question_id and attempt=1.]",
      turnKind: "silence_escalate",
    });

    expect(plan.control.questionId).toBe("q_02_generated");
    expect(plan.control.attempt).toBe(1);
    expect(plan.control.isFollowup).toBe(false);
    expect(plan.spokenText).toBe("What signals tell you a queue backlog is becoming a production incident?");
    expect(plan.questionSource).toBe("generated");
  });
});
