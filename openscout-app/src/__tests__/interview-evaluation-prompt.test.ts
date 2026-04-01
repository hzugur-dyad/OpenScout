import { describe, expect, it } from "vitest";

import { buildRecruiterGradeInterviewEvaluationSystemPrompt } from "@/lib/ai/prompts";

describe("buildRecruiterGradeInterviewEvaluationSystemPrompt", () => {
  it("defines the weighted recruiter-grade JSON contract in English", () => {
    const prompt = buildRecruiterGradeInterviewEvaluationSystemPrompt("Senior Backend Engineer", "en", "");

    expect(prompt).toContain("recruiter-grade evaluation lead");
    expect(prompt).toContain("Do not reward memorized definitions");
    expect(prompt).toContain("Repeated weak answers must stack negatively");
    expect(prompt).toContain("technical_knowledge = 25%");
    expect(prompt).toContain("problem_solving = 25%");
    expect(prompt).toContain("system_design = 20%");
    expect(prompt).toContain("communication = 15%");
    expect(prompt).toContain("tradeoffs = 10%");
    expect(prompt).toContain("practical_experience = 5%");
    expect(prompt).toContain("\"final_score\": 0");
    expect(prompt).toContain("\"answer_breakdown\": [");
    expect(prompt).toContain("\"hire_recommendation\": \"yes\"");
  });

  it("mirrors the same structured contract in Turkish", () => {
    const prompt = buildRecruiterGradeInterviewEvaluationSystemPrompt("Junior Frontend Developer", "tr", "");

    expect(prompt).toContain("recruiter-grade kaliteyle degerlendir");
    expect(prompt).toContain("Her mantiksal soru icin sonucu strong | medium | weak | no_response");
    expect(prompt).toContain("Yayinlanan final_score agirliklari SABIT kalmali");
    expect(prompt).toContain("\"technical_knowledge\": { \"score\": 0, \"reason\": \"\" }");
    expect(prompt).toContain("\"hire_recommendation\": \"yes\"");
  });
});
