import "server-only";

import { createHash } from "node:crypto";

export const INTERVIEW_SESSION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeInterviewSessionId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return INTERVIEW_SESSION_ID_RE.test(trimmed) ? trimmed : null;
}

export function hashInterviewTranscript(transcript: string): string {
  return createHash("sha256").update(transcript, "utf8").digest("hex");
}
