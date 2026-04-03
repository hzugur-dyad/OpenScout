import "server-only";

import type { InterviewLocale } from "@/lib/interview-locale";
import { buildSsmlForSpeech, formatTextForSpeech } from "@/lib/tts-text";
import {
  classifyStandardProviderFailoverError,
  hasProviderApiKeys,
  ProviderRequestError,
  type ProviderKeyEnvConfig,
  withProviderKeyFailover,
} from "@/lib/provider-key-failover";

const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

export const GOOGLE_CLOUD_TTS_KEY_ENV_CONFIG: ProviderKeyEnvConfig = {
  provider: "google-cloud-tts",
  singleKeyEnv: "GOOGLE_CLOUD_TTS_API_KEY",
  multiKeyEnv: "GOOGLE_CLOUD_TTS_API_KEYS",
  indexedKeyEnvPrefix: "GOOGLE_CLOUD_TTS_API_KEY_",
  notConfiguredMessage:
    "Google Cloud TTS API keys are not configured. Set GOOGLE_CLOUD_TTS_API_KEY, GOOGLE_CLOUD_TTS_API_KEYS, or indexed GOOGLE_CLOUD_TTS_API_KEY_1 style variables.",
};

type LanguageTtsConfig = {
  languageCode: string;
  preferredVoiceNames: string[];
  speakingRate?: number;
  pitch?: number;
  effectsProfileIds?: string[];
  ssmlGender: "FEMALE" | "MALE" | "NEUTRAL";
};

export const TTS_LANGUAGE_CONFIG: Record<InterviewLocale, LanguageTtsConfig> = {
  en: {
    languageCode: "en-US",
    preferredVoiceNames: [
      "en-US-Chirp3-HD-Leda",
      "en-US-Chirp3-HD-Kore",
      "en-US-Chirp3-HD-Zephyr",
      "en-US-Chirp3-HD-Aoede",
      "en-US-Neural2-F",
      "en-US-Wavenet-F",
      "en-US-Standard-F",
    ],
    speakingRate: 0.95,
    pitch: -1.4,
    effectsProfileIds: ["headphone-class-device"],
    ssmlGender: "FEMALE",
  },
  tr: {
    languageCode: "tr-TR",
    preferredVoiceNames: [
      "tr-TR-Chirp3-HD-Leda",
      "tr-TR-Chirp3-HD-Kore",
      "tr-TR-Chirp3-HD-Zephyr",
      "tr-TR-Chirp3-HD-Aoede",
      "tr-TR-Wavenet-A",
      "tr-TR-Wavenet-C",
      "tr-TR-Standard-A",
    ],
    speakingRate: 1.08,
    pitch: -1.4,
    effectsProfileIds: ["headphone-class-device"],
    ssmlGender: "FEMALE",
  },
};

function parseGoogleTtsError(raw: string): { message: string; code?: string } {
  if (!raw) return { message: "Google TTS request failed" };
  try {
    const errJson = JSON.parse(raw) as {
      error?: { message?: string; status?: string };
    };
    return {
      message: errJson?.error?.message || raw,
      code: errJson?.error?.status,
    };
  } catch {
    return { message: raw };
  }
}

function isVoiceUnavailable(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("voice") && (m.includes("does not exist") || m.includes("not found"));
}

function isUnsupportedPitch(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("pitch") && m.includes("does not support");
}

function isUnsupportedSpeakingRate(message: string): boolean {
  const m = message.toLowerCase();
  return (m.includes("speakingrate") || m.includes("speaking rate")) && m.includes("does not support");
}

function isUnsupportedEffectsProfile(message: string): boolean {
  const m = message.toLowerCase();
  return (
    (m.includes("effectsprofileid") || m.includes("effects profile")) &&
    (m.includes("unsupported") || m.includes("invalid") || m.includes("not support"))
  );
}

type GoogleAudioConfig = {
  audioEncoding: "MP3";
  speakingRate?: number;
  pitch?: number;
  effectsProfileId?: string[];
};

function buildPreferredAudioConfig(cfg: LanguageTtsConfig): GoogleAudioConfig {
  const audioConfig: GoogleAudioConfig = { audioEncoding: "MP3" };
  if (typeof cfg.speakingRate === "number") {
    audioConfig.speakingRate = cfg.speakingRate;
  }
  if (typeof cfg.pitch === "number") {
    audioConfig.pitch = cfg.pitch;
  }
  if (cfg.effectsProfileIds?.length) {
    audioConfig.effectsProfileId = [...cfg.effectsProfileIds];
  }
  return audioConfig;
}

function downgradeAudioConfig(audioConfig: GoogleAudioConfig, message: string): GoogleAudioConfig | null {
  if (audioConfig.effectsProfileId?.length && isUnsupportedEffectsProfile(message)) {
    const { effectsProfileId: _ignored, ...rest } = audioConfig;
    return rest;
  }

  if (typeof audioConfig.pitch === "number" && isUnsupportedPitch(message)) {
    const { pitch: _ignored, ...rest } = audioConfig;
    return rest;
  }

  if (typeof audioConfig.speakingRate === "number" && isUnsupportedSpeakingRate(message)) {
    const { speakingRate: _ignored, ...rest } = audioConfig;
    return rest;
  }

  return null;
}

function assertTurkishTtsPayloadIntegrity(originalText: string, finalText: string): void {
  const utf8RoundTrip = new TextDecoder("utf-8", { fatal: true }).decode(new TextEncoder().encode(finalText));
  if (utf8RoundTrip !== finalText) {
    throw new Error("Turkish TTS payload failed UTF-8 round-trip integrity");
  }

  if (originalText !== finalText) {
    throw new Error("Turkish TTS text changed before synthesis");
  }
}

async function synthesizeInterviewSpeechWithKey(args: {
  text: string;
  locale: InterviewLocale;
  apiKey: string;
}): Promise<{ buffer: Buffer; selectedVoice: string | null }> {
  const { text, locale, apiKey } = args;
  const cfg = TTS_LANGUAGE_CONFIG[locale];
  const finalText = formatTextForSpeech(text, locale);
  if (locale === "tr") {
    assertTurkishTtsPayloadIntegrity(text, finalText);
  }
  const ssml = buildSsmlForSpeech(finalText, locale);

  let lastError = "Google TTS request failed";

  const voiceCandidates: Array<string | null> = locale === "tr" ? [...cfg.preferredVoiceNames] : [...cfg.preferredVoiceNames, null];
  for (const voiceName of voiceCandidates) {
    if (locale === "tr" && voiceName && !voiceName.startsWith("tr-TR-")) {
      throw new Error(`Non-Turkish voice configured for Turkish TTS: ${voiceName}`);
    }

    const voicePayload = voiceName
      ? { languageCode: cfg.languageCode, name: voiceName }
      : { languageCode: cfg.languageCode, ssmlGender: cfg.ssmlGender };

    let audioConfig: GoogleAudioConfig | null = buildPreferredAudioConfig(cfg);
    while (audioConfig) {
      const res = await fetch(`${GOOGLE_TTS_URL}?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Accept-Charset": "utf-8",
        },
        body: JSON.stringify({
          input: { ssml },
          voice: voicePayload,
          audioConfig,
        }),
      });

      if (!res.ok) {
        const parsedError = parseGoogleTtsError(await res.text());
        const message = parsedError.message;
        lastError = message;

        if (voiceName && isVoiceUnavailable(message)) {
          break;
        }

        const downgradedConfig = downgradeAudioConfig(audioConfig, message);
        if (downgradedConfig) {
          audioConfig = downgradedConfig;
          continue;
        }

        throw new ProviderRequestError({
          provider: "google-cloud-tts",
          message,
          status: res.status,
          code: parsedError.code,
        });
      }

      const data = (await res.json()) as { audioContent?: string };
      const b64 = data?.audioContent;
      if (!b64 || typeof b64 !== "string") {
        throw new Error("Google TTS did not return audio");
      }

      return { buffer: Buffer.from(b64, "base64"), selectedVoice: voiceName };
    }
  }

  throw new Error(lastError);
}

export function hasGoogleCloudTtsApiKeysConfigured(): boolean {
  return hasProviderApiKeys(GOOGLE_CLOUD_TTS_KEY_ENV_CONFIG);
}

export async function synthesizeInterviewSpeech(args: {
  text: string;
  locale: InterviewLocale;
}): Promise<{ buffer: Buffer; selectedVoice: string | null }> {
  const { text, locale } = args;

  return withProviderKeyFailover({
    config: GOOGLE_CLOUD_TTS_KEY_ENV_CONFIG,
    operationName: "google-cloud-tts.text:synthesize",
    classifyError: classifyStandardProviderFailoverError,
    execute: ({ key }) =>
      synthesizeInterviewSpeechWithKey({
        text,
        locale,
        apiKey: key,
      }),
  });
}
