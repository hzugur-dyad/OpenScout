import "server-only";

import type { InterviewLocale } from "@/lib/interview-locale";
import {
  classifyStandardProviderFailoverError,
  hasProviderApiKeys,
  ProviderRequestError,
  type ProviderKeyEnvConfig,
  withProviderKeyFailover,
} from "@/lib/provider-key-failover";

const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

// Keep a small safety margin for SSML wrappers/tags.
const MAX_TEXT_LENGTH = 4500;

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
  speakingRate: number;
  pitch: number;
};

export const TTS_LANGUAGE_CONFIG: Record<InterviewLocale, LanguageTtsConfig> = {
  en: {
    languageCode: "en-US",
    preferredVoiceNames: ["en-US-Neural2-F", "en-US-Wavenet-F", "en-US-Standard-F"],
    speakingRate: 1,
    pitch: 0,
  },
  tr: {
    languageCode: "tr-TR",
    // Prefer premium neural voices; fallback progressively for compatibility.
    preferredVoiceNames: ["tr-TR-Chirp3-HD-Achernar", "tr-TR-Wavenet-B", "tr-TR-Wavenet-A", "tr-TR-Standard-B"],
    speakingRate: 1.02,
    pitch: -1,
  },
};

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildSsml(rawText: string): string {
  const safeText = rawText.length > MAX_TEXT_LENGTH ? rawText.slice(0, MAX_TEXT_LENGTH) : rawText;
  const normalized = safeText.replace(/\s+/g, " ").trim();
  if (!normalized) return "<speak></speak>";

  const sentenceParts = normalized
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(escapeXml);

  if (sentenceParts.length <= 1) {
    return `<speak>${sentenceParts[0] ?? ""}</speak>`;
  }

  const withBreaks = sentenceParts.join('<break time="280ms"/>');
  return `<speak>${withBreaks}</speak>`;
}

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

async function synthesizeInterviewSpeechWithKey(args: {
  text: string;
  locale: InterviewLocale;
  apiKey: string;
}): Promise<{ buffer: Buffer; selectedVoice: string | null }> {
  const { text, locale, apiKey } = args;
  const cfg = TTS_LANGUAGE_CONFIG[locale];
  const ssml = buildSsml(text);

  let lastError = "Google TTS request failed";

  const voiceCandidates: Array<string | null> = [...cfg.preferredVoiceNames, null];
  for (const voiceName of voiceCandidates) {
    const voicePayload = voiceName
      ? { languageCode: cfg.languageCode, name: voiceName }
      : { languageCode: cfg.languageCode, ssmlGender: "FEMALE" as const };

    const audioConfigCandidates: Array<{ audioEncoding: "MP3"; speakingRate?: number; pitch?: number }> = [
      { audioEncoding: "MP3", speakingRate: cfg.speakingRate, pitch: cfg.pitch },
      { audioEncoding: "MP3", speakingRate: cfg.speakingRate },
      { audioEncoding: "MP3" },
    ];

    for (let i = 0; i < audioConfigCandidates.length; i++) {
      const audioConfig = audioConfigCandidates[i];
      const res = await fetch(`${GOOGLE_TTS_URL}?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        if (i === 0 && isUnsupportedPitch(message)) {
          continue;
        }
        if (i <= 1 && isUnsupportedSpeakingRate(message)) {
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
