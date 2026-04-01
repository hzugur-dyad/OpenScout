import { describe, expect, it } from "vitest";
import { buildInterviewThinkingSystemPrompt } from "@/lib/interview/promptBuilder";
import { buildInterviewFallbackQuestion, createInterviewTurnPlan } from "@/services/interview";

describe("mock interview planner policy", () => {
  it("prioritizes employer custom questions before generated main questions", () => {
    const customQuestion = "Walk me through the biggest production incident you handled.";

    const plan = createInterviewTurnPlan({
      locale: "en",
      displayName: "Taylor",
      role: "Backend Engineer",
      decision: {
        action: "advance",
        spokenPrompt: "How do you prevent cache stampede under heavy read traffic?",
        nextQuestion: "How do you prevent cache stampede under heavy read traffic?",
        followUp: null,
        assessmentFocus: "cache invalidation and production trade-offs",
        evaluationHint: "Look for concrete mitigation steps.",
        difficulty: "hard",
        isOffTopic: false,
        closingReason: null,
      },
      questionHistory: [],
      remainingCustomQuestions: [customQuestion],
      isOpeningTurn: false,
    });

    expect(plan.questionSource).toBe("custom");
    expect(plan.nextQuestion).toBe(customQuestion);
    expect(plan.spokenText).toBe(customQuestion);
    expect(plan.control.attempt).toBe(1);
    expect(plan.control.isFollowup).toBe(false);
  });

  it("allows only one follow-up on the same question thread before advancing", () => {
    const plan = createInterviewTurnPlan({
      locale: "en",
      displayName: "Taylor",
      role: "Backend Engineer",
      decision: {
        action: "follow_up",
        spokenPrompt: "Which metric told you the queue was saturated first?",
        nextQuestion: "How do you manage backpressure in queue workers at scale?",
        followUp: "Which metric told you the queue was saturated first?",
        assessmentFocus: "queue pressure signals and recovery strategy",
        evaluationHint: "Check for concrete operational metrics.",
        difficulty: "hard",
        isOffTopic: false,
        closingReason: null,
      },
      currentControl: {
        questionId: "q_01_generated",
        attempt: 2,
        isFollowup: true,
      },
      questionHistory: [
        {
          questionId: "q_01_generated",
          prompt: "Describe how you debugged a queue backlog in production.",
          source: "generated",
          difficulty: "medium",
        },
      ],
      remainingCustomQuestions: [],
      isOpeningTurn: false,
    });

    expect(plan.questionSource).toBe("generated");
    expect(plan.nextQuestion).toBe("How do you manage backpressure in queue workers at scale?");
    expect(plan.spokenText).toBe("How do you manage backpressure in queue workers at scale?");
    expect(plan.control.questionId).toBe("q_02_generated");
    expect(plan.control.attempt).toBe(1);
    expect(plan.control.isFollowup).toBe(false);
  });

  it("falls back to a direct technical question when planner content is empty", () => {
    const fallbackQuestion = buildInterviewFallbackQuestion("en", "Backend Engineer");

    const plan = createInterviewTurnPlan({
      locale: "en",
      displayName: "Taylor",
      role: "Backend Engineer",
      decision: {
        action: "advance",
        spokenPrompt: "",
        nextQuestion: "",
        followUp: null,
        assessmentFocus: "",
        evaluationHint: "",
        difficulty: "medium",
        isOffTopic: false,
        closingReason: null,
      },
      questionHistory: [],
      remainingCustomQuestions: [],
      isOpeningTurn: false,
    });

    expect(plan.questionSource).toBe("generated");
    expect(plan.nextQuestion).toBe(fallbackQuestion);
    expect(plan.spokenText).toBe(fallbackQuestion);
  });

  it("does not duplicate Nova's self-introduction on the opening turn", () => {
    const plan = createInterviewTurnPlan({
      locale: "en",
      displayName: "Onur",
      role: "Frontend Developer",
      decision: {
        action: "advance",
        spokenPrompt: "Hello Candidate, I'm Nova. Let's start with your experience in React component lifecycle.",
        nextQuestion: "Hello Candidate, I'm Nova. Let's start with your experience in React component lifecycle.",
        followUp: null,
        assessmentFocus: "React lifecycle depth",
        evaluationHint: "Look for concrete component lifecycle examples.",
        difficulty: "medium",
        isOffTopic: false,
        closingReason: null,
      },
      questionHistory: [],
      remainingCustomQuestions: [],
      isOpeningTurn: true,
    });

    expect(plan.spokenText).toBe(
      "Hello Onur, I'm Nova. We'll keep this technical and concise for the Frontend Developer role. Let's start with your experience in React component lifecycle."
    );
  });

  it("embeds the global policy and bans generic HR questions in the planner prompt", () => {
    const prompt = buildInterviewThinkingSystemPrompt({
      locale: "en",
      jobContext: {
        role: "Backend Engineer",
        description: "Build API platforms.",
        requirements: "Own debugging and performance work.",
        customQuestions: ["Ask about incident response."],
      },
      currentControl: {
        questionId: "q_01_generated",
        attempt: 1,
        isFollowup: false,
      },
      remainingCustomQuestions: ["Ask about incident response."],
      questionHistory: [],
      turnKind: "voice_turn",
    });

    expect(prompt).toContain("GLOBAL POLICY v");
    expect(prompt).toContain("If employer custom questions exist, ask them first and in order without skipping.");
    expect(prompt).toContain("Do not generate generic HR questions.");
    expect(prompt).toContain('If turnKind is "silence", restate the same question once');
    expect(prompt).toContain('If turnKind is "silence_escalate" or "timeout", do not repeat the same question');
  });
});
