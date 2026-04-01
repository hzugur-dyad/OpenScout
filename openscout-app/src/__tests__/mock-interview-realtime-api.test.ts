import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as postRealtimeClientSecret } from "@/app/api/mock-interview/realtime/client-secret/route";
import { POST as postDeprecatedRealtimeProxy } from "@/app/api/mock-interview/realtime/route";
import { MOCK_INTERVIEW_REALTIME_OUTPUT_MODALITIES } from "@/lib/mock-interview/realtime";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseForMockInterviewRealtimeRoute } from "@/test/supabase-mocks";
import {
  DEFAULT_MOCK_INTERVIEW_LIVE_MODEL,
  MOCK_INTERVIEW_LIVE_PROVIDER,
} from "@/lib/mock-interview/versioning";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("POST /api/mock-interview/realtime/client-secret", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    vi.restoreAllMocks();
    process.env.OPENAI_API_KEY = "test-openai-key";
    delete process.env.OPENAI_MOCK_INTERVIEW_LIVE_MODEL;
    delete process.env.OPENAI_REALTIME_ASSISTANT_VOICE;
    delete process.env.OPENAI_REALTIME_INPUT_TRANSCRIPTION_MODEL;
  });

  it("uses audio-only realtime output by default", () => {
    expect([...MOCK_INTERVIEW_REALTIME_OUTPUT_MODALITIES]).toEqual(["audio"]);
  });

  it("returns 401 when unauthenticated", async () => {
    const { client } = createSupabaseForMockInterviewRealtimeRoute({
      userId: null,
      profileGuard: "complete",
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const req = new NextRequest("http://localhost/api/mock-interview/realtime/client-secret", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "session-1",
        jobCategory: "Engineering",
        interviewLanguage: "en",
      }),
    });

    const res = await postRealtimeClientSecret(req);
    expect(res.status).toBe(401);
  });

  it("returns 500 when OPENAI_API_KEY is missing", async () => {
    const { client } = createSupabaseForMockInterviewRealtimeRoute({
      userId: "user-1",
      profileGuard: "complete",
    });
    vi.mocked(createClient).mockResolvedValue(client as never);
    delete process.env.OPENAI_API_KEY;

    const req = new NextRequest("http://localhost/api/mock-interview/realtime/client-secret", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "session-1",
        jobCategory: "Engineering",
        interviewLanguage: "en",
      }),
    });

    const res = await postRealtimeClientSecret(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/OPENAI_API_KEY/);
  });

  it("mints a client secret with the realtime session config and employer questions", async () => {
    const { client } = createSupabaseForMockInterviewRealtimeRoute({
      userId: "user-1",
      profileGuard: "complete",
      jobRow: {
        ai_interview_config: {
          custom_questions: ["Walk me through a production incident you handled."],
        },
      },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          value: "ek_test_secret_123",
          expires_at: 1_756_310_470,
          session: {
            type: "realtime",
            id: "sess_test_123",
            model: DEFAULT_MOCK_INTERVIEW_LIVE_MODEL,
            output_modalities: [...MOCK_INTERVIEW_REALTIME_OUTPUT_MODALITIES],
            audio: {
              output: { voice: "marin" },
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", "x-request-id": "req-client-secret-1" },
        }
      )
    );

    const req = new NextRequest("http://localhost/api/mock-interview/realtime/client-secret", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "session-xyz",
        jobCategory: "Backend Engineer",
        userName: "Taylor",
        jobId: "job-1",
        interviewLanguage: "en",
      }),
    });

    const res = await postRealtimeClientSecret(req);
    expect(res.status).toBe(200);

    const payload = await res.json();
    expect(payload).toMatchObject({
      client_secret: "ek_test_secret_123",
      provider: MOCK_INTERVIEW_LIVE_PROVIDER,
      model: DEFAULT_MOCK_INTERVIEW_LIVE_MODEL,
      expires_at: 1_756_310_470,
    });
    expect(payload.session?.model).toBe(DEFAULT_MOCK_INTERVIEW_LIVE_MODEL);
    expect(payload.session?.output_modalities).toEqual([...MOCK_INTERVIEW_REALTIME_OUTPUT_MODALITIES]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/realtime/client_secrets");

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-openai-key",
      "Content-Type": "application/json",
    });

    const requestJson = JSON.parse(String(init.body)) as { session: Record<string, unknown> };
    expect(requestJson.session.model).toBe(DEFAULT_MOCK_INTERVIEW_LIVE_MODEL);
    expect(requestJson.session.output_modalities).toEqual([...MOCK_INTERVIEW_REALTIME_OUTPUT_MODALITIES]);
    expect(requestJson.session.instructions).toContain("Walk me through a production incident you handled.");
    expect(requestJson.session.instructions).toContain("report_interview_state");
    expect(requestJson.session.audio).toMatchObject({
      input: { turn_detection: null },
      output: { voice: "marin" },
    });
    expect(Array.isArray(requestJson.session.tools)).toBe(true);
  });

  it("normalizes the legacy realtime model alias to the GA gpt-realtime model", async () => {
    const { client } = createSupabaseForMockInterviewRealtimeRoute({
      userId: "user-1",
      profileGuard: "complete",
    });
    vi.mocked(createClient).mockResolvedValue(client as never);
    process.env.OPENAI_MOCK_INTERVIEW_LIVE_MODEL = "gpt-realtime-1.5";

    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          value: "ek_test_secret_alias_fix",
          expires_at: 1_756_310_470,
          session: {
            type: "realtime",
            id: "sess_alias_fix",
            model: DEFAULT_MOCK_INTERVIEW_LIVE_MODEL,
            output_modalities: [...MOCK_INTERVIEW_REALTIME_OUTPUT_MODALITIES],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    const req = new NextRequest("http://localhost/api/mock-interview/realtime/client-secret", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "session-alias-fix",
        jobCategory: "Engineering",
        interviewLanguage: "en",
      }),
    });

    const res = await postRealtimeClientSecret(req);
    expect(res.status).toBe(200);

    const payload = await res.json();
    expect(payload.model).toBe(DEFAULT_MOCK_INTERVIEW_LIVE_MODEL);
    expect(payload.model).not.toBe("gpt-realtime-1.5");

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const requestJson = JSON.parse(String(init.body)) as { session: Record<string, unknown> };
    expect(requestJson.session.model).toBe(DEFAULT_MOCK_INTERVIEW_LIVE_MODEL);
  });

  it("returns a sanitized voice error when client secret minting times out upstream", async () => {
    const { client } = createSupabaseForMockInterviewRealtimeRoute({
      userId: "user-1",
      profileGuard: "complete",
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("<html><title>504 Gateway Time-out</title><body>cloudflare</body></html>", {
        status: 504,
        statusText: "Gateway Time-out",
        headers: { "Content-Type": "text/html", "cf-ray": "cf-client-secret-timeout" },
      })
    );

    const req = new NextRequest("http://localhost/api/mock-interview/realtime/client-secret", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "session-timeout-final",
        jobCategory: "Backend Engineer",
        interviewLanguage: "en",
      }),
    });

    const res = await postRealtimeClientSecret(req);
    expect(res.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const body = await res.json();
    expect(body).toMatchObject({
      error: "Voice service temporarily unavailable. Please try again.",
      code: "upstream_gateway_timeout",
      operation: "client_secret_mint",
    });
    expect(body.error).not.toContain("<html");
  });
});

describe("POST /api/mock-interview/realtime", () => {
  it("returns 410 because SDP proxy bootstrap is deprecated", async () => {
    const res = await postDeprecatedRealtimeProxy();
    expect(res.status).toBe(410);

    const body = await res.json();
    expect(body).toMatchObject({
      code: "realtime_sdp_proxy_deprecated",
      operation: "realtime_proxy_deprecated",
      provider: MOCK_INTERVIEW_LIVE_PROVIDER,
    });
    expect(body.error).toContain("/api/mock-interview/realtime/client-secret");
  });
});
