import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/mock-interview/route";
import { createClient } from "@/lib/supabase/server";
import { getGroq } from "@/lib/groq";
import { checkProfileAndCv } from "@/lib/profile-guard";
import { INTERVIEW_CONTRACT_USER_LINES } from "@/lib/mock-interview/interview-contract-messages";
import {
  buildBilingualTechnicalLanguagePrompt,
  enrichInterviewMessagesForModel,
  normalizeTechnicalTerms,
} from "@/lib/mock-interview/technical-language";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/groq", () => ({
  getGroq: vi.fn(),
}));

vi.mock("@/lib/profile-guard", () => ({
  checkProfileAndCv: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitIdentifier: vi.fn(() => "rl-1"),
  isRateLimitBypassed: vi.fn(() => false),
  rateLimitForKind: vi.fn(async () => ({ success: true })),
  tooManyRequestsResponse: vi.fn(),
}));

vi.mock("@/lib/monitoring", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(getGroq).mockReset();
  vi.mocked(checkProfileAndCv).mockReset();

  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-1" } },
      }),
    },
  } as never);

  vi.mocked(checkProfileAndCv).mockResolvedValue({
    canApplyOrInterview: true,
    profileComplete: true,
    hasCv: true,
  } as never);
});

describe("mock interview bilingual terminology prompt", () => {
  it("locks response language while keeping internal technical understanding bilingual", () => {
    const trPrompt = buildBilingualTechnicalLanguagePrompt("tr");
    const enPrompt = buildBilingualTechnicalLanguagePrompt("en");

    expect(trPrompt).toContain('RESPONSE LANGUAGE LOCK: interview_language="tr" -> respond ONLY in Turkish.');
    expect(enPrompt).toContain('RESPONSE LANGUAGE LOCK: interview_language="en" -> respond ONLY in English.');
    expect(trPrompt).toContain("You are fluent in bilingual (Turkish + English) technical communication.");
    expect(enPrompt).toContain("Treat English technical terms as universal");
    expect(trPrompt).toContain("<technical_normalization>");
  });
});

describe("technical terminology normalization", () => {
  it("standardizes common Turkish technical variants for internal understanding", () => {
    const normalized = normalizeTechnicalTerms(
      "Apı tarafinda bekend ile frondend arasinda databeyz kveri optimizasyonu yaptim."
    );

    expect(normalized.standardizedText).toContain("api");
    expect(normalized.standardizedText).toContain("backend");
    expect(normalized.standardizedText).toContain("frontend");
    expect(normalized.standardizedText).toContain("database");
    expect(normalized.standardizedText).toContain("query");
    expect(normalized.replacements).toEqual(
      expect.arrayContaining([
        { original: "apı", normalized: "api" },
        { original: "bekend", normalized: "backend" },
        { original: "frondend", normalized: "frontend" },
        { original: "databeyz", normalized: "database" },
        { original: "kveri", normalized: "query" },
      ])
    );
  });

  it("keeps contract cue messages unchanged", () => {
    const messages = enrichInterviewMessagesForModel([
      {
        role: "user" as const,
        content: INTERVIEW_CONTRACT_USER_LINES.tr.timeout,
      },
      {
        role: "user" as const,
        content: "Ben apı tarafinda bekend sistemleriyle calistim.",
      },
    ]);

    expect(messages[0]?.content).toBe(INTERVIEW_CONTRACT_USER_LINES.tr.timeout);
    expect(messages[1]?.content).toContain("<technical_normalization>");
    expect(messages[1]?.content).toContain("apı=api");
    expect(messages[1]?.content).toContain("bekend=backend");
  });
});

describe("POST /api/mock-interview bilingual terminology handling", () => {
  it("sends normalization hints to the model without changing interview flow structure", async () => {
    const createMock = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content:
              'Bu API endpoint async calisiyor mu?\n{"type":"question_control","question_id":"q1","attempt":1,"is_followup":false}',
          },
        },
      ],
    });

    vi.mocked(getGroq).mockReturnValue({
      chat: {
        completions: {
          create: createMock,
        },
      },
    } as never);

    const req = new NextRequest("http://localhost/api/mock-interview", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: "Ben apı tarafinda bekend ve databeyz kveri optimizasyonu yaptim.",
          },
        ],
        jobCategory: "Backend Engineer",
        userName: "Ada",
        interviewLanguage: "tr",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(createMock).toHaveBeenCalledTimes(1);
    const groqPayload = createMock.mock.calls[0]?.[0] as {
      messages?: Array<{ role: string; content: string }>;
    };
    const systemMessage = groqPayload.messages?.[0];
    const userMessage = groqPayload.messages?.[1];

    expect(systemMessage?.role).toBe("system");
    expect(systemMessage?.content).toContain(
      'RESPONSE LANGUAGE LOCK: interview_language="tr" -> respond ONLY in Turkish.'
    );
    expect(userMessage?.content).toContain("<technical_normalization>");
    expect(userMessage?.content).toContain("apı=api");
    expect(userMessage?.content).toContain("bekend=backend");
    expect(userMessage?.content).toContain("databeyz=database");
    expect(userMessage?.content).toContain("kveri=query");

    const body = (await res.json()) as {
      interviewEnded: boolean;
      questionControl?: { questionId: string; attempt: number; isFollowup: boolean };
    };

    expect(body.interviewEnded).toBe(false);
    expect(body.questionControl).toMatchObject({
      questionId: "q1",
      attempt: 1,
      isFollowup: false,
    });
  });
});
