// @vitest-environment node

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { getGroq } from "@/lib/groq";
import { parseMockInterviewAssistantTurn } from "@/lib/ai/structured-output";
import { buildInterviewerSystemPrompt } from "@/lib/mock-interview-prompt";
import { buildBilingualTechnicalLanguagePrompt } from "@/lib/mock-interview/technical-language";
import { GROQ_MOCK_INTERVIEW_MODEL } from "@/lib/mock-interview/versioning";

const runLiveSmoke = process.env.LIVE_SMOKE === "1";

function loadGroqKeysFromEnvFile(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    if (!/^GROQ_API_KEY(?:_|$)/.test(key)) continue;
    if (process.env[key]) continue;

    process.env[key] = trimmed.slice(eq + 1).trim();
  }
}

type SampleCase = {
  role: string;
  locale: "en" | "tr";
  displayName: string;
  startMessage: string;
};

const SAMPLE_CASES: SampleCase[] = [
  { role: "Junior Android Developer", locale: "en", displayName: "Alex", startMessage: "Let's start the interview." },
  { role: "Mid Backend Developer", locale: "en", displayName: "Mina", startMessage: "Let's begin." },
  { role: "Senior Frontend Developer", locale: "en", displayName: "Sam", startMessage: "Start interview." },
  { role: "Senior Data Engineer", locale: "en", displayName: "Riley", startMessage: "Begin interview." },
  { role: "Junior Mechanical Engineer", locale: "en", displayName: "Jordan", startMessage: "Let's start." },
  { role: "Mid Electrical Engineer", locale: "en", displayName: "Taylor", startMessage: "Begin." },
  { role: "Senior Electrical & Electronics Engineer", locale: "en", displayName: "Morgan", startMessage: "Start." },
];

describe("manual mock interview role samples", () => {
  it.skipIf(!runLiveSmoke)(
    "generates first-turn questions for several roles",
    async () => {
      loadGroqKeysFromEnvFile();
      const groq = getGroq();
      const outputs: Array<{
        role: string;
        visible: string;
        questionControl: { questionId: string; attempt: number; isFollowup: boolean } | null;
      }> = [];

      for (const sample of SAMPLE_CASES) {
        const systemPrompt = [
          buildInterviewerSystemPrompt(sample.locale, {
            jobCategory: sample.role,
            displayName: sample.displayName,
            userName: sample.displayName,
            customQuestionsBlock: "",
          }),
          buildBilingualTechnicalLanguagePrompt(sample.locale),
        ].join("\n\n");

        const completion = await groq.chat.completions.create({
          model: GROQ_MOCK_INTERVIEW_MODEL,
          temperature: 0.2,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: sample.startMessage },
          ],
        });

        const raw = (completion.choices[0]?.message?.content ?? "").trim();
        const parsed = parseMockInterviewAssistantTurn(raw);
        const visible = parsed.visibleText.trim();

        console.log(`\n[ROLE] ${sample.role}`);
        console.log(visible);
        if (parsed.questionControl) {
          console.log(
            `[CONTROL] ${parsed.questionControl.questionId} attempt=${parsed.questionControl.attempt} followup=${parsed.questionControl.isFollowup}`
          );
        }

        outputs.push({
          role: sample.role,
          visible,
          questionControl: parsed.questionControl
            ? {
                questionId: parsed.questionControl.questionId,
                attempt: parsed.questionControl.attempt,
                isFollowup: parsed.questionControl.isFollowup,
              }
            : null,
        });

        expect(visible.length).toBeGreaterThan(10);
        expect(parsed.questionControl || parsed.interviewEnd).toBeTruthy();
      }

      const outDir = path.resolve(process.cwd(), ".tmp");
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(
        path.join(outDir, "mock-interview-role-samples.json"),
        JSON.stringify(outputs, null, 2),
        "utf8"
      );
    },
    120_000
  );
});
