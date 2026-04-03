import { describe, expect, it } from "vitest";

import { buildRecruiterGradeInterviewEvaluationSystemPrompt } from "@/lib/ai/prompts";

describe("buildRecruiterGradeInterviewEvaluationSystemPrompt", () => {
  it("defines a question-level evidence-only JSON contract in English", () => {
    const prompt = buildRecruiterGradeInterviewEvaluationSystemPrompt("Senior Backend Engineer", "en", "");

    expect(prompt).toContain("recruiter-grade evaluation lead");
    expect(prompt).toContain("Your job is ONLY question-level structured evaluation");
    expect(prompt).toContain("Do NOT compute or output final_score");
    expect(prompt).toContain("If a question has follow-ups");
    expect(prompt).toContain("\"question_evaluations\": [");
    expect(prompt).toContain("\"answered\": true");
    expect(prompt).toContain("\"tradeoff_awareness\": 0");
    expect(prompt).toContain("Do not add final_score, confidence, coverage_score");
  });

  it("mirrors the same structured contract in Turkish", () => {
    const prompt = buildRecruiterGradeInterviewEvaluationSystemPrompt("Junior Frontend Developer", "tr", "");

    expect(prompt).toContain("recruiter-grade kaliteyle soru bazli degerlendir");
    expect(prompt).toContain("Bu modelin gorevi SADECE soru bazli yapisal degerlendirme uretmektir");
    expect(prompt).toContain("final_score, overall_score, confidence, coverage_score");
    expect(prompt).toContain("\"question_evaluations\": [");
    expect(prompt).toContain("\"answered\": true");
    expect(prompt).toContain("\"tradeoff_awareness\": 0");
  });
});
