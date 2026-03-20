import type { InterviewLocale } from "@/lib/interview-locale";

const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

// Keep a small safety margin for SSML wrappers/tags.
const MAX_TEXT_LENGTH = 4500;

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

function parseGoogleTtsMessage(raw: string): string {
  if (!raw) return "Google TTS request failed";
  try {
    const errJson = JSON.parse(raw) as { error?: { message?: string } };
    return errJson?.error?.message || raw;
  } catch {
    return raw;
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

export async function synthesizeInterviewSpeech(args: {
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
        const message = parseGoogleTtsMessage(await res.text());
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
        throw new Error(message);
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
