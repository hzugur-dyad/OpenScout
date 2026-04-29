import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/tts/route";
import { createClient } from "@/lib/supabase/server";
import { hasGoogleCloudTtsApiKeysConfigured, synthesizeInterviewSpeech } from "@/lib/tts";

const ttsHoisted = vi.hoisted(() => ({
  rateLimitForKind: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitIdentifier: (r: Request, uid?: string | null) =>
    uid ? `u:${uid}` : `ip:${r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"}`,
  rateLimitForKind: (...a: unknown[]) => ttsHoisted.rateLimitForKind(...a),
  tooManyRequestsResponse: () =>
    new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/tts", () => ({
  hasGoogleCloudTtsApiKeysConfigured: vi.fn(),
  synthesizeInterviewSpeech: vi.fn(),
}));

describe("POST /api/tts", () => {
  beforeEach(() => {
    process.env.GOOGLE_CLOUD_TTS_API_KEY = "test-tts-key-not-secret-leak";
    vi.mocked(createClient).mockReset();
    vi.mocked(synthesizeInterviewSpeech).mockReset();
    vi.mocked(hasGoogleCloudTtsApiKeysConfigured).mockReset();
    ttsHoisted.rateLimitForKind.mockReset();
    ttsHoisted.rateLimitForKind.mockResolvedValue({ success: true });
    vi.mocked(hasGoogleCloudTtsApiKeysConfigured).mockReturnValue(true);
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-tts-1" } } }),
      },
    } as never);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "Invalid JSON body" });
  });

  it("returns 400 when text is missing", async () => {
    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: "en" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("applies rate limit with authenticated bucket when user is present", async () => {
    vi.mocked(synthesizeInterviewSpeech).mockResolvedValue({
      buffer: Buffer.from([0, 1, 2]),
      selectedVoice: "v",
    });
    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hello there.", locale: "en" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(ttsHoisted.rateLimitForKind).toHaveBeenCalledWith("tts", "u:user-tts-1");
  });

  it("uses ip-based rate limit bucket when unauthenticated", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: null } }),
      },
    } as never);
    vi.mocked(synthesizeInterviewSpeech).mockResolvedValue({
      buffer: Buffer.from([9, 9]),
      selectedVoice: null,
    });

    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.2, 10.0.0.1",
      },
      body: JSON.stringify({ text: "Hi.", locale: "tr" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(ttsHoisted.rateLimitForKind).toHaveBeenCalledWith("tts", "ip:198.51.100.2");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    ttsHoisted.rateLimitForKind.mockResolvedValueOnce({
      success: false,
      limit: 30,
      remaining: 0,
      reset: Date.now() + 60_000,
    });
    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Blocked." }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(vi.mocked(synthesizeInterviewSpeech)).not.toHaveBeenCalled();
  });

  it("rejects oversized single text before calling the provider", async () => {
    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "x".repeat(1201), locale: "en" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(vi.mocked(synthesizeInterviewSpeech)).not.toHaveBeenCalled();
  });

  it("rejects oversized chunk payloads before calling the provider", async () => {
    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chunks: ["x".repeat(801)], locale: "en" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(vi.mocked(synthesizeInterviewSpeech)).not.toHaveBeenCalled();
  });

  it("returns 500 when TTS API key is not configured (message is generic config hint)", async () => {
    delete process.env.GOOGLE_CLOUD_TTS_API_KEY;
    vi.mocked(hasGoogleCloudTtsApiKeysConfigured).mockReturnValue(false);
    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hello world here." }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/GOOGLE_CLOUD_TTS_API_KEY/);
    const leaked = JSON.stringify(body);
    expect(leaked).not.toMatch(/sk_live|sk_test|AIza real/i);
  });

  it("returns 502 with safe error when provider fails", async () => {
    vi.mocked(synthesizeInterviewSpeech).mockRejectedValue(new Error("Google TTS quota exceeded"));
    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Say this." }),
    });
    const res = await POST(req);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("Google TTS quota exceeded");
    expect(JSON.stringify(body)).not.toMatch(/test-tts-key-not-secret-leak/);
  });

  it("returns audio/mpeg bytes on success", async () => {
    vi.mocked(synthesizeInterviewSpeech).mockResolvedValue({
      buffer: Buffer.from([0xff, 0xf3, 0x90, 0x00]),
      selectedVoice: "en-US-Neural2-F",
    });
    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "One two three.", locale: "en" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
  });

  it("returns chunked audio payloads when multiple short speech chunks are requested", async () => {
    vi.mocked(synthesizeInterviewSpeech)
      .mockResolvedValueOnce({
        buffer: Buffer.from("chunk-one"),
        selectedVoice: "en-US-Chirp3-HD-Leda",
      })
      .mockResolvedValueOnce({
        buffer: Buffer.from("chunk-two"),
        selectedVoice: "en-US-Chirp3-HD-Leda",
      });

    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chunks: ["First chunk.", "Second chunk."], locale: "en" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");

    const body = (await res.json()) as { audioChunks?: string[] };
    expect(body.audioChunks).toEqual([
      Buffer.from("chunk-one").toString("base64"),
      Buffer.from("chunk-two").toString("base64"),
    ]);
    expect(vi.mocked(synthesizeInterviewSpeech)).toHaveBeenNthCalledWith(1, {
      text: "First chunk.",
      locale: "en",
    });
    expect(vi.mocked(synthesizeInterviewSpeech)).toHaveBeenNthCalledWith(2, {
      text: "Second chunk.",
      locale: "en",
    });
  });

  it("preserves Turkish characters end-to-end in the API body", async () => {
    vi.mocked(synthesizeInterviewSpeech).mockResolvedValue({
      buffer: Buffer.from([1, 2, 3]),
      selectedVoice: "tr-TR-Wavenet-A",
    });

    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ text: "  edeceğim, çözüm, dışarı, öğrenci, geliştirme, bağlantı  ", locale: "tr" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(vi.mocked(synthesizeInterviewSpeech)).toHaveBeenCalledWith({
      text: "  edeceğim, çözüm, dışarı, öğrenci, geliştirme, bağlantı  ",
      locale: "tr",
    });
  });
});
