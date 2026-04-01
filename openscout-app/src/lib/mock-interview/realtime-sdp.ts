export type RealtimeSdpSummary = {
  hasIceCandidate: boolean;
  length: number;
  lineCount: number;
  startsWithVersion: boolean;
  hasOrigin: boolean;
  hasSessionName: boolean;
  hasTiming: boolean;
  hasAudioMLine: boolean;
  hasIceUfrag: boolean;
  hasIcePwd: boolean;
  hasFingerprint: boolean;
};

export function normalizeRealtimeSdp(value: string): string {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return "";
  return `${normalized.split("\n").join("\r\n")}\r\n`;
}

export function summarizeRealtimeSdp(value: string): RealtimeSdpSummary {
  const normalized = normalizeRealtimeSdp(value);
  return {
    hasIceCandidate: /(?:^|\r\n)a=candidate:/.test(normalized),
    length: normalized.length,
    lineCount: normalized ? normalized.split("\r\n").filter(Boolean).length : 0,
    startsWithVersion: normalized.startsWith("v=0\r\n"),
    hasOrigin: /(?:^|\r\n)o=/.test(normalized),
    hasSessionName: /(?:^|\r\n)s=/.test(normalized),
    hasTiming: /(?:^|\r\n)t=/.test(normalized),
    hasAudioMLine: /(?:^|\r\n)m=audio /.test(normalized),
    hasIceUfrag: /(?:^|\r\n)a=ice-ufrag:/.test(normalized),
    hasIcePwd: /(?:^|\r\n)a=ice-pwd:/.test(normalized),
    hasFingerprint: /(?:^|\r\n)a=fingerprint:/.test(normalized),
  };
}

export function isLikelyRealtimeSessionSdp(value: string): boolean {
  const summary = summarizeRealtimeSdp(value);
  return (
    summary.length > 0 &&
    summary.startsWithVersion &&
    summary.hasOrigin &&
    summary.hasSessionName &&
    summary.hasTiming &&
    summary.hasAudioMLine &&
    summary.hasIceUfrag &&
    summary.hasIcePwd &&
    summary.hasFingerprint
  );
}

export function isLikelyRealtimeOfferSdp(value: string): boolean {
  return isLikelyRealtimeSessionSdp(value);
}

export function extractRealtimeAnswerSdp(value: string): string {
  const normalized = normalizeRealtimeSdp(value);
  if (isLikelyRealtimeSessionSdp(normalized)) return normalized;

  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const nested =
      readNestedSdp(parsed) ||
      (parsed &&
      typeof parsed === "object" &&
      "answer" in parsed &&
      typeof (parsed as { answer?: unknown }).answer === "string"
        ? (parsed as { answer: string }).answer
        : null);

    if (!nested) return normalized;

    const normalizedNested = normalizeRealtimeSdp(nested);
    return isLikelyRealtimeSessionSdp(normalizedNested) ? normalizedNested : normalized;
  } catch {
    return normalized;
  }
}

function readNestedSdp(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;

  const directSdp =
    "sdp" in value && typeof (value as { sdp?: unknown }).sdp === "string"
      ? (value as { sdp: string }).sdp
      : null;
  if (directSdp?.trim()) return directSdp;

  const answerSdp =
    "answer" in value && value.answer && typeof value.answer === "object"
      ? readNestedSdp(value.answer)
      : null;
  if (answerSdp?.trim()) return answerSdp;

  const dataSdp =
    "data" in value && value.data && typeof value.data === "object"
      ? readNestedSdp(value.data)
      : null;
  if (dataSdp?.trim()) return dataSdp;

  return null;
}
