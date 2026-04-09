import { describe, expect, it } from "vitest";

import { buildInterviewerSystemPrompt } from "@/lib/mock-interview-prompt";

const baseArgs = {
  jobCategory: "Senior Backend Engineer",
  displayName: "Alex",
  userName: "Alex",
  customQuestionsBlock: "",
};

describe("buildInterviewerSystemPrompt", () => {
  it("enforces spoken delivery, topic progression, and one follow-up max in English", () => {
    const prompt = buildInterviewerSystemPrompt("en", baseArgs);

    expect(prompt).toContain("ONE realistic role-based scenario");
    expect(prompt).toContain("Ask exactly ONE thing at a time.");
    expect(prompt).toContain("Do not recap the candidate's full answer");
    expect(prompt).toContain("Each topic gets at most 2 interviewer turns");
    expect(prompt).toContain("Most turns can use 2-4 spoken sentences");
    expect(prompt).toContain('Exception: if the candidate is weak, wrong, vague, or says "I don\'t know", your visible reply must stay within 1-2 short sentences.');
    expect(prompt).toContain("Do not cut substance just to sound brief");
    expect(prompt).toContain("Sound like a real human interviewer speaking live");
    expect(prompt).toContain('Avoid robotic lead-ins like "You mentioned..." or "As you said..."');
    expect(prompt).toContain('"You could try..." beats "You should consider implementing..."');
    expect(prompt).toContain("WEAK / WRONG / UNKNOWN ANSWER STYLE:");
    expect(prompt).toContain('If the candidate says "I don\'t know", usually acknowledge it briefly and move on.');
    expect(prompt).toContain("Do not explain the correct answer");
    expect(prompt).toContain("architecture");
    expect(prompt).toContain("core_logic");
    expect(prompt).toContain("final_pressure");
    expect(prompt).toContain("internal topic keys only");
    expect(prompt).toContain("Never leak internal topic labels or metadata words into visible text.");
    expect(prompt).toContain("Do not create derived same-topic ids for a third layer.");
    expect(prompt).toContain(`Say: "Hi ${baseArgs.displayName}, I'm Nova. I'll be with you through today's interview."`);
    expect(prompt).toContain("\"type\":\"question_control\"");
    expect(prompt).toContain("\"type\":\"interview_end\"");
    expect(prompt).not.toContain("Each spoken turn must stay within 1-2 sentences.");
    expect(prompt).not.toContain("Follow-up 2");
    expect(prompt).not.toContain("mint a NEW derived question_id");
  });

  it("injects a hard android-specialization boundary and allows short junior technical prompts", () => {
    const prompt = buildInterviewerSystemPrompt("en", {
      ...baseArgs,
      jobCategory: "Junior Android Developer",
    });

    expect(prompt).toContain('Treat "Junior Android Developer" as a HARD specialization boundary.');
    expect(prompt).toContain("Android architecture, Compose or Views");
    expect(prompt).toContain("Do not ask backend service ownership");
    expect(prompt).toContain("Short direct technical prompts are allowed");
    expect(prompt).toContain("CURATED TOPIC PACK:");
    expect(prompt).toContain("remember vs rememberSaveable");
    expect(prompt).not.toContain("Frontend / web / UI:");
    expect(prompt).not.toContain("Backend / API: design, caching, consistency, queueing, resilience.");
  });

  it("locks backend interviews away from mobile-client question drift", () => {
    const prompt = buildInterviewerSystemPrompt("en", baseArgs);

    expect(prompt).toContain('Treat "Senior Backend Engineer" as a HARD specialization boundary.');
    expect(prompt).toContain("Service architecture, API design, data modeling");
    expect(prompt).toContain("Do not ask mobile lifecycle, Jetpack Compose/SwiftUI");
    expect(prompt).toContain("Clients only through API contracts");
    expect(prompt).toContain("CURATED TOPIC PACK:");
    expect(prompt).toContain("Legacy monolith split");
  });

  it("mirrors the same spoken-style topic discipline in Turkish", () => {
    const prompt = buildInterviewerSystemPrompt("tr", baseArgs);

    expect(prompt).toContain("TEK gercekci scenario");
    expect(prompt).toContain("Her soruda yalnizca TEK sey sor.");
    expect(prompt).toContain("Her topic icin en fazla 2 interviewer turn kullan");
    expect(prompt).toContain("Cogu tur 2-4 konusma cumlesi olabilir");
    expect(prompt).toContain('aday zayif, yanlis, muallak cevap verirse ya da "bilmiyorum" derse gorunur yanitin en fazla 1-2 kisa cumle olsun');
    expect(prompt).toContain("Sirf kisa olsun diye icerigi budama");
    expect(prompt).toContain("dogal spoken Turkish kullan");
    expect(prompt).toContain("robotik girisleri mecbur kalmadikca kullanma");
    expect(prompt).toContain('"Sunu deneyebilirsin" gibi');
    expect(prompt).toContain("ZAYIF / YANLIS / BILMIYORUM STILI:");
    expect(prompt).toContain('Aday "bilmiyorum" derse genelde kisaca kabul et ve ilerle.');
    expect(prompt).toContain("Dogru cevabi tam anlatma");
    expect(prompt).toContain("architecture");
    expect(prompt).toContain("tradeoffs_decision");
    expect(prompt).toContain("sadece ic topic anahtarlari");
    expect(prompt).toContain("Ic topic label'larini veya metadata kelimelerini gorunur metne sizdirma.");
    expect(prompt).toContain("Ayni topicte derived question_id ile ucuncu katman acma.");
    expect(prompt).toContain(`"Merhaba ${baseArgs.displayName}, ben Nova.`);
    expect(prompt).toContain("\"type\":\"question_control\"");
    expect(prompt).toContain("\"type\":\"interview_end\"");
    expect(prompt).not.toContain("Her tur en fazla 1-2 cumle olsun.");
    expect(prompt).not.toContain("Follow-up 2");
    expect(prompt).not.toContain("YENI turetilmis bir question_id");
  });

  it("adds the same hard role boundary in Turkish for mobile-specialized interviews", () => {
    const prompt = buildInterviewerSystemPrompt("tr", {
      ...baseArgs,
      jobCategory: "Junior Android Developer",
    });

    expect(prompt).toContain('\"Junior Android Developer\" title\'ini KATI uzmanlik siniri kabul et');
    expect(prompt).toContain("Android architecture, Compose veya Views");
    expect(prompt).toContain("Backend servis ownership");
    expect(prompt).toContain("direkt teknik sorular serbest");
    expect(prompt).toContain("KURETE TOPIC PACK:");
    expect(prompt).toContain("remember vs rememberSaveable");
    expect(prompt).not.toContain('Frontend / web / UI:');
  });
});
