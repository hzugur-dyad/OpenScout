import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/mock-interview/route";
import { createClient } from "@/lib/supabase/server";
import { getGroq } from "@/lib/groq";
import { checkProfileAndCv } from "@/lib/profile-guard";
import {
  buildInterviewQuestionFallback,
  coerceInterviewQuestionPrompt,
  extractInterviewQuestionPrompt,
  isQuestionLikeInterviewPrompt,
  sanitizeInterviewVisibleText,
} from "@/lib/mock-interview/question-guard";

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

describe("mock interview question guard", () => {
  it("recognizes technical prompts even without a question mark", () => {
    expect(isQuestionLikeInterviewPrompt("Explain the difference between LiveData and StateFlow.")).toBe(true);
    expect(
      isQuestionLikeInterviewPrompt(
        "You are given a legacy app with poor architecture and high technical debt. How do you refactor it."
      )
    ).toBe(true);
    expect(isQuestionLikeInterviewPrompt("Hi, tell me a bit about yourself.")).toBe(false);
    expect(isQuestionLikeInterviewPrompt("Let's move on.")).toBe(false);
  });

  it("extracts the technical question and drops greeting or filler lead-in", () => {
    expect(
      extractInterviewQuestionPrompt(
        "Hi Alex, I'm Nova. What happens to an Android ViewModel after a configuration change?",
        "en"
      )
    ).toBe("What happens to an Android ViewModel after a configuration change?");

    expect(
      extractInterviewQuestionPrompt(
        "Tamam. failure_handling topigine gecelim. Mobil uygulamada ANR gordugunde ilk neye bakarsin?",
        "tr"
      )
    ).toBe("Mobil uygulamada ANR gordugunde ilk neye bakarsin?");
  });

  it("coerces filler assistant text into a deterministic fallback question", () => {
    expect(
      coerceInterviewQuestionPrompt({
        text: "Let's move on.",
        locale: "en",
        jobCategory: "Android Developer",
      })
    ).toBe(buildInterviewQuestionFallback("en", "Android Developer"));
  });

  it("scrubs internal topic labels from candidate-facing text without dropping the question", () => {
    const visible = sanitizeInterviewVisibleText(
      "Tamam, performans optimizasyonu konusunu geciyoruz. failure_handling topigine gecelim. Mobil uygulamanizda bir hata olustugunda ne yaparsiniz?",
      "tr"
    );

    expect(visible).not.toContain("failure_handling");
    expect(visible).toContain("hata yonetimi");
    expect(visible).toContain("Mobil uygulamanizda bir hata olustugunda ne yaparsiniz?");
  });
});

describe("POST /api/mock-interview question guard", () => {
  it("rewrites non-question assistant text before returning question control", async () => {
    const createMock = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content:
              'Let\'s move on.\n{"type":"question_control","question_id":"q1","attempt":1,"is_followup":false}',
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
        messages: [{ role: "user", content: "Hello, I'm ready for the interview." }],
        jobCategory: "Android Developer",
        userName: "Ada",
        interviewLanguage: "en",
      }),
    });

    const res = await POST(req);
    const body = (await res.json()) as {
      content: string;
      interviewEnded: boolean;
      questionControl?: { questionId: string; attempt: number; isFollowup: boolean };
    };

    expect(res.status).toBe(200);
    expect(body.interviewEnded).toBe(false);
    expect(body.content).toBe(buildInterviewQuestionFallback("en", "Android Developer"));
    expect(body.questionControl).toMatchObject({
      questionId: "q1",
      attempt: 1,
      isFollowup: false,
    });
  });

  it("scrubs internal topic labels from a valid question-control response", async () => {
    const createMock = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content:
              'Tamam, performans optimizasyonu konusunu geciyoruz. failure_handling topigine gecelim. Mobil uygulamanizda bir hata olustugunda ne yaparsiniz?\n{"type":"question_control","question_id":"q5","attempt":1,"is_followup":false}',
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
        messages: [{ role: "user", content: "Merhaba, mulakata hazirim." }],
        jobCategory: "Mobile Developer",
        userName: "Ada",
        interviewLanguage: "tr",
      }),
    });

    const res = await POST(req);
    const body = (await res.json()) as {
      content: string;
      interviewEnded: boolean;
      questionControl?: { questionId: string; attempt: number; isFollowup: boolean };
    };

    expect(res.status).toBe(200);
    expect(body.interviewEnded).toBe(false);
    expect(body.content).not.toContain("failure_handling");
    expect(body.content).not.toContain("hata yonetimi");
    expect(body.content).toContain("Mobil uygulamanizda bir hata olustugunda ne yaparsiniz?");
    expect(body.questionControl).toMatchObject({
      questionId: "q5",
      attempt: 1,
      isFollowup: false,
    });
  });

  it("strips greeting text from a mixed question-control response before returning it", async () => {
    const createMock = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content:
              'Hi Ada, I\'m Nova. What happens to a ViewModel after an Activity recreation?\n{"type":"question_control","question_id":"q1","attempt":1,"is_followup":false}',
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
        messages: [{ role: "user", content: "Hello, I'm ready for the interview." }],
        jobCategory: "Android Developer",
        userName: "Ada",
        interviewLanguage: "en",
      }),
    });

    const res = await POST(req);
    const body = (await res.json()) as {
      content: string;
      interviewEnded: boolean;
      questionControl?: { questionId: string; attempt: number; isFollowup: boolean };
    };

    expect(res.status).toBe(200);
    expect(body.interviewEnded).toBe(false);
    expect(body.content).toBe("What happens to a ViewModel after an Activity recreation?");
    expect(body.questionControl).toMatchObject({
      questionId: "q1",
      attempt: 1,
      isFollowup: false,
    });
  });

  it("forces a fallback question when the model never emits structured output", async () => {
    const createMock = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: "Let's move on.",
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
        messages: [{ role: "user", content: "Hello, I'm ready for the interview." }],
        jobCategory: "Backend Engineer",
        userName: "Ada",
        interviewLanguage: "en",
      }),
    });

    const res = await POST(req);
    const body = (await res.json()) as {
      content: string;
      interviewEnded: boolean;
      questionControl?: { questionId: string; attempt: number; isFollowup: boolean };
    };

    expect(res.status).toBe(200);
    expect(body.interviewEnded).toBe(false);
    expect(body.content).toBe(buildInterviewQuestionFallback("en", "Backend Engineer"));
    expect(body.questionControl).toMatchObject({
      questionId: "q_start",
      attempt: 1,
      isFollowup: false,
    });
    expect(createMock).toHaveBeenCalledTimes(3);
  });
});
