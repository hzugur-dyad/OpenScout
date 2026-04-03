import { describe, expect, it } from "vitest";

import { parseInterviewEvaluationModelOutput } from "@/lib/ai/structured-output";

describe("parseInterviewEvaluationModelOutput", () => {
  it("computes deterministic competency averages, final score, coverage, and confidence from question evaluations", () => {
    const result = parseInterviewEvaluationModelOutput(
      JSON.stringify({
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
      })
    );

    expect(result.finalScore).toBe(81);
    expect(result.overallScore).toBe(81);
    expect(result.confidence).toBe("high");
    expect(result.coverageScore).toBe(93);
    expect(result.isPreliminary).toBe(false);
    expect(result.technicalScore).toBe(85);
    expect(result.communicationScore).toBe(78);
    expect(result.problemSolvingScore).toBe(83);
    expect(result.competencyBreakdown).toEqual({
      technical_knowledge: 85,
      problem_solving: 83,
      communication: 78,
      system_design: 73,
      tradeoff_awareness: 78,
    });
    expect(result.categories.technical_knowledge.score).toBe(9);
    expect(result.questionEvaluations).toHaveLength(4);
    expect(result.answerBreakdown[0]).toEqual({
      question_id: "q1",
      result: "strong",
      reason: "The candidate explained cache invalidation trade-offs with concrete failure cases.",
    });
  });

  it("clamps short interviews into a preliminary band with low confidence", () => {
    const result = parseInterviewEvaluationModelOutput(
      JSON.stringify({
        question_evaluations: [
          {
            question_id: "q1",
            answered: true,
            label: "strong",
            score: 9,
            competencies: {
              technical_knowledge: 9,
              problem_solving: 9,
              communication: 8,
              system_design: 8,
              tradeoff_awareness: 8,
            },
            reason: "The candidate gave a strong incident triage and mitigation answer.",
          },
          {
            question_id: "q2",
            answered: true,
            label: "strong",
            score: 8,
            competencies: {
              technical_knowledge: 8,
              problem_solving: 8,
              communication: 8,
              system_design: 7,
              tradeoff_awareness: 8,
            },
            reason: "They compared rollback versus forward-fix and named the main trade-offs.",
          },
        ],
      })
    );

    expect(result.coverage.totalQuestions).toBe(2);
    expect(result.coverage.answeredQuestions).toBe(2);
    expect(result.coverage.usableAnswerCount).toBe(2);
    expect(result.confidence).toBe("low");
    expect(result.coverageScore).toBe(79);
    expect(result.isPreliminary).toBe(true);
    expect(result.finalScore).toBe(35);
    expect(result.summary).toContain("Preliminary assessment");
    expect(result.technicalScore).toBe(36);
  });

  it("returns a conservative fallback when question-level evidence is missing", () => {
    const result = parseInterviewEvaluationModelOutput(
      JSON.stringify({
        score: 64,
        justification: "Solid fundamentals, but depth dropped on follow-up.",
        strengths: ["Clear communication"],
        improvements: ["Go deeper on distributed systems"],
        technical_score: 68,
        communication_score: 74,
        problem_solving_score: 60,
        answer_breakdown: [
          {
            question_id: "q1",
            result: "medium",
            reason: "The explanation was workable but not deeply detailed.",
          },
        ],
      })
    );

    expect(result.usedFallback).toBe(true);
    expect(result.finalScore).toBe(0);
    expect(result.confidence).toBe("low");
    expect(result.isPreliminary).toBe(true);
    expect(result.hireRecommendation).toBe("strong_no");
    expect(result.technicalScore).toBe(0);
    expect(result.communicationScore).toBe(0);
    expect(result.problemSolvingScore).toBe(0);
    expect(result.categories.communication.score).toBe(0);
    expect(result.answerBreakdown).toEqual([
      {
        question_id: "q1",
        result: "medium",
        reason: "The explanation was workable but not deeply detailed.",
      },
    ]);
    expect(result.justification).toContain("conservative low-evidence result");
  });

  it("scores empty or unanswered interviews at zero", () => {
    const result = parseInterviewEvaluationModelOutput(
      JSON.stringify({
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
      })
    );

    expect(result.finalScore).toBe(0);
    expect(result.coverage.answeredQuestions).toBe(0);
    expect(result.coverage.usableAnswerCount).toBe(0);
    expect(result.confidence).toBe("low");
    expect(result.isPreliminary).toBe(true);
    expect(result.hireRecommendation).toBe("strong_no");
    expect(result.categories.technical_knowledge.score).toBe(0);
  });

  it("keeps a lone weak answer in the low-evidence band", () => {
    const result = parseInterviewEvaluationModelOutput(
      JSON.stringify({
        question_evaluations: [
          {
            question_id: "q1",
            answered: true,
            label: "weak",
            score: 3,
            competencies: {
              technical_knowledge: 2,
              problem_solving: 2,
              communication: 3,
              system_design: 1,
              tradeoff_awareness: 2,
            },
            reason: "The candidate gave a vague answer with almost no supporting detail.",
          },
        ],
      })
    );

    expect(result.coverage.answeredQuestions).toBe(1);
    expect(result.coverage.usableAnswerCount).toBe(0);
    expect(result.finalScore).toBe(10);
    expect(result.confidence).toBe("low");
    expect(result.isPreliminary).toBe(true);
    expect(result.hireRecommendation).toBe("strong_no");
    expect(result.technicalScore).toBe(10);
  });
});
