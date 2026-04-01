import { describe, expect, it } from "vitest";

import { buildInterviewerSystemPrompt } from "@/lib/ai/prompts";

const baseArgs = {
  jobCategory: "Senior Backend Engineer",
  displayName: "Alex",
  userName: "Alex",
  customQuestionsBlock: "",
};

describe("buildInterviewerSystemPrompt", () => {
  it("adds senior-level scenario and evaluation guidance without changing the control contract in English", () => {
    const prompt = buildInterviewerSystemPrompt("en", baseArgs);

    expect(prompt).toContain("senior-level technical interviewer and hiring specialist");
    expect(prompt).toContain("Ask production-level, scenario-based questions");
    expect(prompt).toContain("Avoid trivia, definition-only questions");
    expect(prompt).toContain("system design thinking");
    expect(prompt).toContain("trade-off awareness");
    expect(prompt).toContain("use at most one targeted follow-up on the same question_id");
    expect(prompt).toContain("\"type\":\"question_control\"");
    expect(prompt).toContain("\"type\":\"interview_end\"");
  });

  it("mirrors the same quality bar in Turkish", () => {
    const prompt = buildInterviewerSystemPrompt("tr", baseArgs);

    expect(prompt).toContain("kıdemli seviyede teknik mülakatçısın ve işe alım uzmanısın");
    expect(prompt).toContain("Üretim seviyesi, senaryo bazlı");
    expect(prompt).toContain("Trivia, sadece tanım isteyen sorular");
    expect(prompt).toContain("system design thinking");
    expect(prompt).toContain("trade-off awareness");
    expect(prompt).toContain("aynı question_id üzerinde en fazla 1 hedefli takip sorusu");
    expect(prompt).toContain("\"type\":\"question_control\"");
    expect(prompt).toContain("\"type\":\"interview_end\"");
  });
});
