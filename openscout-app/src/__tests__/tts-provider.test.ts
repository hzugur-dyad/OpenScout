import { beforeEach, describe, expect, it, vi } from "vitest";

import { getGroq } from "@/lib/groq";
import { logInfo, logWarn } from "@/lib/logger";
import {
  __resetProviderKeyFailoverStateForTests,
  ProviderRequestError,
  withProviderKeyFailover,
  type ProviderKeyEnvConfig,
} from "@/lib/provider-key-failover";
import { synthesizeInterviewSpeech, TTS_LANGUAGE_CONFIG } from "@/lib/tts";
import { buildSsmlForSpeech, formatTextForSpeech, splitTextIntoSpeechChunks } from "@/lib/tts-text";

const groqHoisted = vi.hoisted(() => ({
  createByKey: new Map<string, ReturnType<typeof vi.fn>>(),
}));

vi.mock("groq-sdk", () => ({
  default: vi.fn().mockImplementation(function GroqMock(this: unknown, { apiKey }: { apiKey: string }) {
    const create = groqHoisted.createByKey.get(apiKey);
    if (!create) {
      throw new Error(`Unexpected Groq key in test: ${apiKey}`);
    }
    return {
      chat: {
        completions: {
          create,
        },
      },
    };
  }),
}));

const TEST_PROVIDER_CONFIG: ProviderKeyEnvConfig = {
  provider: "test-ai",
  singleKeyEnv: "TEST_AI_API_KEY",
  multiKeyEnv: "TEST_AI_API_KEYS",
  indexedKeyEnvPrefix: "TEST_AI_API_KEY_",
  notConfiguredMessage: "test-ai keys missing",
  cooldownMs: 60_000,
};

function clearProviderEnv() {
  delete process.env.TEST_AI_API_KEY;
  delete process.env.TEST_AI_API_KEYS;
  delete process.env.TEST_AI_API_KEY_1;
  delete process.env.TEST_AI_API_KEY_2;

  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEYS;
  delete process.env.GROQ_API_KEY_1;
  delete process.env.GROQ_API_KEY_2;

  delete process.env.GOOGLE_CLOUD_TTS_API_KEY;
  delete process.env.GOOGLE_CLOUD_TTS_API_KEYS;
  delete process.env.GOOGLE_CLOUD_TTS_API_KEY_1;
  delete process.env.GOOGLE_CLOUD_TTS_API_KEY_2;
}

beforeEach(() => {
  clearProviderEnv();
  __resetProviderKeyFailoverStateForTests();
  groqHoisted.createByKey.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("provider key failover", () => {
  it("retries with the next configured key and keeps using the working key", async () => {
    process.env.TEST_AI_API_KEYS = "key-primary,key-backup";

    const attempts: string[] = [];
    const result = await withProviderKeyFailover({
      config: TEST_PROVIDER_CONFIG,
      operationName: "test.provider.request",
      execute: async ({ key }) => {
        attempts.push(key);
        if (key === "key-primary") {
          throw new ProviderRequestError({
            provider: "test-ai",
            status: 429,
            message: "Rate limit exceeded for current key",
          });
        }
        return "ok";
      },
    });

    expect(result).toBe("ok");
    expect(attempts).toEqual(["key-primary", "key-backup"]);
    expect(vi.mocked(logWarn)).toHaveBeenCalledWith(
      "test-ai API key failed",
      expect.objectContaining({
        key_index: 1,
        error_type: "rate_limited",
      }),
    );
    expect(vi.mocked(logInfo)).toHaveBeenCalledWith(
      "test-ai switched to backup key #2",
      expect.objectContaining({
        key_index: 2,
      }),
    );

    const followUpAttempts: string[] = [];
    const followUp = await withProviderKeyFailover({
      config: TEST_PROVIDER_CONFIG,
      operationName: "test.provider.request",
      execute: async ({ key }) => {
        followUpAttempts.push(key);
        return key;
      },
    });

    expect(followUp).toBe("key-backup");
    expect(followUpAttempts).toEqual(["key-backup"]);
  });

  it("supports indexed env variables", async () => {
    process.env.TEST_AI_API_KEY_1 = "indexed-1";
    process.env.TEST_AI_API_KEY_2 = "indexed-2";

    const seen: string[] = [];
    const result = await withProviderKeyFailover({
      config: TEST_PROVIDER_CONFIG,
      operationName: "test.provider.indexed",
      execute: async ({ key }) => {
        seen.push(key);
        return "done";
      },
    });

    expect(result).toBe("done");
    expect(seen).toEqual(["indexed-1"]);
  });
});

describe("Groq provider wrapper", () => {
  it("fails over to the next Groq key on quota/auth errors", async () => {
    process.env.GROQ_API_KEYS = "groq-primary,groq-backup";

    const primaryCreate = vi.fn().mockRejectedValue(
      new ProviderRequestError({
        provider: "groq",
        status: 429,
        message: "quota exceeded",
      }),
    );
    const backupCreate = vi.fn().mockResolvedValue({ id: "groq-ok" });

    groqHoisted.createByKey.set("groq-primary", primaryCreate);
    groqHoisted.createByKey.set("groq-backup", backupCreate);

    const groq = getGroq();
    const result = await groq.chat.completions.create({
      model: "llama-test",
      messages: [],
    } as never);

    expect(result).toEqual({ id: "groq-ok" });
    expect(primaryCreate).toHaveBeenCalledTimes(1);
    expect(backupCreate).toHaveBeenCalledTimes(1);

    const backupCreateSecond = vi.fn().mockResolvedValue({ id: "groq-still-ok" });
    groqHoisted.createByKey.set("groq-backup", backupCreateSecond);

    const followUp = await groq.chat.completions.create({
      model: "llama-test",
      messages: [],
    } as never);

    expect(followUp).toEqual({ id: "groq-still-ok" });
    expect(backupCreateSecond).toHaveBeenCalledTimes(1);
    expect(primaryCreate).toHaveBeenCalledTimes(1);
  });
});

describe("Google Cloud TTS wrapper", () => {
  it("retries synthesis with the next TTS key and keeps the working key active", async () => {
    process.env.GOOGLE_CLOUD_TTS_API_KEYS = "tts-primary,tts-backup";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: "Resource has been exhausted (e.g. check quota).",
              status: "RESOURCE_EXHAUSTED",
            },
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            audioContent: Buffer.from("audio-one").toString("base64"),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            audioContent: Buffer.from("audio-two").toString("base64"),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const first = await synthesizeInterviewSpeech({ text: "Hello from backup.", locale: "en" });
    expect(first.buffer.toString("utf-8")).toBe("audio-one");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("tts-primary");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("tts-backup");

    const second = await synthesizeInterviewSpeech({ text: "Hello again.", locale: "en" });
    expect(second.buffer.toString("utf-8")).toBe("audio-two");
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("tts-backup");
  });

  it("falls back to the next configured voice when the first voice is unavailable", async () => {
    process.env.GOOGLE_CLOUD_TTS_API_KEY = "tts-primary";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: `Voice ${TTS_LANGUAGE_CONFIG.en.preferredVoiceNames[0]} does not exist.`,
              status: "INVALID_ARGUMENT",
            },
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            audioContent: Buffer.from("voice-fallback-audio").toString("base64"),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await synthesizeInterviewSpeech({ text: "Please walk me through the failure mode.", locale: "en" });

    expect(result.buffer.toString("utf-8")).toBe("voice-fallback-audio");
    expect(result.selectedVoice).toBe(TTS_LANGUAGE_CONFIG.en.preferredVoiceNames[1]);

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      voice?: { name?: string };
    };
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      voice?: { name?: string };
      audioConfig?: { speakingRate?: number; pitch?: number; effectsProfileId?: string[] };
    };

    expect(firstBody.voice?.name).toBe(TTS_LANGUAGE_CONFIG.en.preferredVoiceNames[0]);
    expect(secondBody.voice?.name).toBe(TTS_LANGUAGE_CONFIG.en.preferredVoiceNames[1]);
    expect(secondBody.audioConfig?.speakingRate).toBeGreaterThanOrEqual(0.92);
    expect(secondBody.audioConfig?.speakingRate).toBeLessThanOrEqual(0.98);
    expect(secondBody.audioConfig?.pitch).toBeLessThanOrEqual(-1);
    expect(secondBody.audioConfig?.pitch).toBeGreaterThanOrEqual(-2);
    expect(secondBody.audioConfig?.effectsProfileId).toEqual(["headphone-class-device"]);
  });

  it("removes internal control payloads and shapes text for speech-friendly SSML", () => {
    const rawText = [
      "Let's focus on the rollback path.",
      "",
      "<technical_normalization>terms: apı=api</technical_normalization>",
      '{"type":"question_control","question_id":"q1","attempt":1,"is_followup":false}',
    ].join("\n");

    const formatted = formatTextForSpeech(rawText, "en");
    const ssml = buildSsmlForSpeech(rawText, "en");

    expect(formatted).toBe("Let's focus on the rollback path.");
    expect(ssml).toContain("<speak><p><s>Let&apos;s focus on the rollback path.</s></p></speak>");
    expect(ssml).not.toContain("technical_normalization");
    expect(ssml).not.toContain("question_control");
  });

  it("splits long spoken text into short sequential chunks", () => {
    const chunks = splitTextIntoSpeechChunks(
      [
        "You mentioned cache invalidation.",
        "As you said, the stale read risk matters here.",
        "You should consider implementing a write-through strategy, but tell me what breaks first when the queue lags behind.",
      ].join(" "),
      "en"
    );

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.length).toBeLessThanOrEqual(3);
    expect(chunks.join(" ")).not.toContain("You mentioned");
    expect(chunks.join(" ")).not.toContain("As you said");
    expect(chunks.join(" ")).toContain("You could try");
  });

  it("preserves Turkish text exactly as written in the TTS shaping path", () => {
    const text = "Veriyi senkronize edeceğim. Çözüm dışarıda; öğrenci geliştirme bağlantısı hazır.";

    const formatted = formatTextForSpeech(text, "tr");
    const chunks = splitTextIntoSpeechChunks(text, "tr");
    const ssml = buildSsmlForSpeech(text, "tr");

    expect(formatted).toBe(text);
    expect(chunks).toEqual([text]);
    expect(ssml).toBe(`<speak>${text}</speak>`);
  });

  it("sends Turkish synthesis requests as UTF-8 with tr-TR locale and natural settings only", async () => {
    process.env.GOOGLE_CLOUD_TTS_API_KEY = "tts-primary";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          audioContent: Buffer.from("turkish-audio").toString("base64"),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    await synthesizeInterviewSpeech({ text: "İstanbul için ölçülü çözüm şu.", locale: "tr" });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(requestInit?.body)) as {
      input?: { ssml?: string };
      voice?: { languageCode?: string; name?: string; ssmlGender?: string };
      audioConfig?: { speakingRate?: number; pitch?: number };
    };

    expect(requestInit?.headers).toMatchObject({
      "Content-Type": "application/json; charset=utf-8",
      "Accept-Charset": "utf-8",
    });
    expect(body.voice?.languageCode).toBe("tr-TR");
    expect(body.voice?.name?.startsWith("tr-TR-") ?? false).toBe(true);
    expect(body.voice?.ssmlGender).toBeUndefined();
    expect(body.input?.ssml).toContain("İstanbul için ölçülü çözüm şu.");
    expect(body.input?.ssml).not.toContain("Istanbul icin");
    expect(body.voice?.languageCode).not.toBe("en-US");
    expect(body.audioConfig?.speakingRate).toBeGreaterThanOrEqual(1.05);
    expect(body.audioConfig?.speakingRate).toBeLessThanOrEqual(1.12);
    expect(body.audioConfig?.pitch).toBeLessThanOrEqual(-1);
    expect(body.audioConfig?.pitch).toBeGreaterThanOrEqual(-2);
  });
});
