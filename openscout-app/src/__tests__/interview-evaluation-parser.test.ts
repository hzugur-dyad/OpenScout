import { describe, expect, it } from "vitest";

import { parseInterviewEvaluationModelOutput } from "@/lib/ai/structured-output";

describe("parseInterviewEvaluationModelOutput", () => {
  it("normalizes the recruiter-grade schema and recomputes the weighted final score", () => {
    const result = parseInterviewEvaluationModelOutput(
      JSON.stringify({
        final_score: 99,
        categories: {
          technical_knowledge: {
            score: 8,
            reason: "The candidate explained cache invalidation trade-offs with concrete failure cases.",
          },
          problem_solving: {
            score: 7,
            reason: "They broke the incident response into triage, mitigation, and verification steps.",
          },
          system_design: {
            score: 6,
            reason: "The architecture discussion covered scale and observability, but replication strategy stayed thin.",
          },
          communication: {
            score: 8,
            reason: "Answers were structured, direct, and easy to follow under pressure.",
          },
          tradeoffs: {
            score: 7,
            reason: "They compared latency, consistency, and rollout risk instead of naming tools only.",
          },
          practical_experience: {
            score: 6,
            reason: "They referenced production incidents, though some examples lacked ownership detail.",
          },
        },
        answer_breakdown: [
          {
            question_id: "q1",
            result: "strong",
            reason: "Clear root-cause reasoning and mitigation plan.",
          },
          {
            question_id: "q2",
            result: "weak",
            reason: "Needed the follow-up to reach a workable answer.",
          },
        ],
        strengths: ["Strong incident reasoning"],
        weaknesses: ["System design depth was uneven"],
        hire_recommendation: "yes",
      })
    );

    expect(result.overallScore).toBe(72);
    expect(result.technicalScore).toBe(80);
    expect(result.communicationScore).toBe(80);
    expect(result.problemSolvingScore).toBe(70);
    expect(result.categories.system_design.score).toBe(6);
    expect(result.answerBreakdown).toEqual([
      {
        question_id: "q1",
        result: "strong",
        reason: "Clear root-cause reasoning and mitigation plan.",
      },
      {
        question_id: "q2",
        result: "weak",
        reason: "Needed the follow-up to reach a workable answer.",
      },
    ]);
    expect(result.hireRecommendation).toBe("yes");
    expect(result.improvements).toEqual(["System design depth was uneven"]);
  });

  it("keeps supporting the legacy interview scoring shape", () => {
    const result = parseInterviewEvaluationModelOutput(
      JSON.stringify({
        score: 64,
        justification: "Solid fundamentals, but depth dropped on follow-up.",
        strengths: ["Clear communication"],
        improvements: ["Go deeper on distributed systems"],
        technical_score: 68,
        communication_score: 74,
        problem_solving_score: 60,
      })
    );

    expect(result.overallScore).toBe(64);
    expect(result.technicalScore).toBe(68);
    expect(result.communicationScore).toBe(74);
    expect(result.problemSolvingScore).toBe(60);
    expect(result.categories.technical_knowledge.score).toBe(7);
    expect(result.categories.communication.score).toBe(7);
    expect(result.hireRecommendation).toBeNull();
    expect(result.justification).toBe("Solid fundamentals, but depth dropped on follow-up.");
  });
});
