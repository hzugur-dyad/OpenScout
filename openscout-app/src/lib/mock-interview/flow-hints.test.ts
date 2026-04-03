import { describe, expect, it } from "vitest";

import { buildMockInterviewProgressHint, buildMockInterviewServerFlowHint } from "@/lib/mock-interview/flow-hints";

describe("buildMockInterviewProgressHint", () => {
  it("anchors the opening turn to one fixed scenario and architecture", () => {
    const hint = buildMockInterviewProgressHint({
      locale: "en",
      messages: [{ role: "user", content: "I'm ready." }],
    });

    expect(hint).toContain("INTERVIEW STAGE (server): opening");
    expect(hint).toContain("ONE realistic role-based scenario once");
    expect(hint).toContain("architecture");
    expect(hint).toContain("1-2 sentences");
  });

  it("forces a move to the next topic after a follow-up is already used", () => {
    const hint = buildMockInterviewProgressHint({
      locale: "en",
      messages: [
        { role: "assistant", content: "Architecture base" },
        { role: "user", content: "Architecture answer" },
        { role: "assistant", content: "Architecture follow-up" },
        { role: "user", content: "Architecture follow-up answer" },
      ],
      clientPrev: { questionId: "architecture", attemptCount: 2 },
    });

    expect(hint).toContain("INTERVIEW STAGE (server): topic_flow");
    expect(hint).toContain("target_topic=core_logic");
    expect(hint).toContain("next_topic=consistency_correctness");
    expect(hint).toContain("at most 2 interviewer turns per topic");
  });

  it("switches to final pressure when the final topic is reached", () => {
    const hint = buildMockInterviewProgressHint({
      locale: "en",
      messages: [
        { role: "assistant", content: "Tradeoff question" },
        { role: "user", content: "I would bias toward consistency." },
      ],
      clientPrev: { questionId: "final_pressure", attemptCount: 1 },
    });

    expect(hint).toContain("INTERVIEW STAGE (server): final_pressure");
    expect(hint).toContain("decision-based");
    expect(hint).toContain("force prioritization");
  });
});

describe("buildMockInterviewServerFlowHint", () => {
  it("forces the next topic after attempt 2 instead of allowing a third layer", () => {
    const hint = buildMockInterviewServerFlowHint({
      locale: "en",
      lastUserMessage: "I would shard by tenant, keep writes idempotent, and monitor queue lag.",
      clientPrev: { questionId: "core_logic", attemptCount: 2 },
    });

    expect(hint).toContain("Move to the NEXT topic consistency_correctness");
    expect(hint).toContain("prefer consistency");
    expect(hint).toContain("No __deep ids");
    expect(hint).not.toContain("NEW derived question_id");
  });

  it("forces specificity on weak answers before moving on", () => {
    const hint = buildMockInterviewServerFlowHint({
      locale: "en",
      lastUserMessage: "I don't know",
      clientPrev: { questionId: "q_api", attemptCount: 1 },
    });

    expect(hint).toContain("do not go deeper yet");
    expect(hint).toContain("attempt=2, is_followup=true");
    expect(hint).toContain("one rule, one strategy, or one real example");
    expect(hint).toContain("The visible reply must stay within 1-2 short sentences");
    expect(hint).toContain("Do not teach, explain theory, or give the full correct answer");
    expect(hint).toContain('usually acknowledge it briefly and move on');
  });

  it("prefers advancing after strong answers instead of drilling forever", () => {
    const hint = buildMockInterviewServerFlowHint({
      locale: "en",
      lastUserMessage: "I would use versioned cache keys and invalidate on write through the same command path.",
      clientPrev: { questionId: "architecture", attemptCount: 1 },
    });

    expect(hint).toContain("If it is already strong and specific, skip the follow-up");
    expect(hint).toContain("move to core_logic");
    expect(hint).toContain("clarification, constraint, decision, or trade-off");
    expect(hint).toContain("If the answer is clearly wrong, signal that briefly and do not explain the full answer");
  });
});
