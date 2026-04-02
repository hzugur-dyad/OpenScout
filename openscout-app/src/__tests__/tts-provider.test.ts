import { beforeEach, describe, expect, it, vi } from "vitest";

import { getGroq } from "@/lib/groq";
import { logInfo, logWarn } from "@/lib/logger";
import {
  __resetProviderKeyFailoverStateForTests,
  ProviderRequestError,
  withProviderKeyFailover,
  type ProviderKeyEnvConfig,
} from "@/lib/provider-key-failover";
import { synthesizeInterviewSpeech } from "@/lib/tts";

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
});
