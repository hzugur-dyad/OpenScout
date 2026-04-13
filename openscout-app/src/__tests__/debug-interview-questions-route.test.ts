import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "@/app/api/debug/interview-questions/route";
import { getGroq } from "@/lib/groq";

vi.mock("@/lib/groq", () => ({
  getGroq: vi.fn(),
}));

describe("GET /api/debug/interview-questions", () => {
  beforeEach(() => {
    vi.mocked(getGroq).mockReset();
  });

  it("returns only technical question text in the question list and applies the requested level", async () => {
    const createMock = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content:
                'Hi Debug User, I\'m Nova. What causes a stale cache after a write in a distributed system?\n{"type":"question_control","question_id":"q1","attempt":1,"is_followup":false}',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content:
                'Let\'s move on. How do you make that write path idempotent?\n{"type":"question_control","question_id":"q2","attempt":1,"is_followup":false}',
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

    const req = new NextRequest(
      "http://localhost/api/debug/interview-questions?role=Backend%20Developer&level=senior&count=2&lang=en"
    );

    const res = await GET(req);
    const body = (await res.json()) as {
      role: string;
      level: string;
      questions: Array<{ index: number; question: string }>;
    };

    expect(res.status).toBe(200);
    expect(body.role).toBe("Backend Developer");
    expect(body.level).toBe("senior");
    expect(body.questions).toMatchObject([
      {
        index: 1,
        question: "What causes a stale cache after a write in a distributed system?",
        questionId: "q1",
        attempt: 1,
        isFollowup: false,
      },
      {
        index: 2,
        question: "How do you make that write path idempotent?",
        questionId: "q2",
        attempt: 1,
        isFollowup: false,
      },
    ]);

    const firstCall = createMock.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
    expect(firstCall.messages[0]?.content).toContain("Senior Backend Developer");
  });
});
