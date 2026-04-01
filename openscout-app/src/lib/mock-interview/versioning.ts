/** Groq model used for live mock interview completions and final evaluation. */
export const GROQ_MOCK_INTERVIEW_MODEL = "llama-3.3-70b-versatile";

/** Default OpenAI Realtime model used for the live voice interview path. */
export const DEFAULT_MOCK_INTERVIEW_LIVE_MODEL = "gpt-realtime";

/**
 * Legacy aliases that were pinned during the Realtime beta/transition period.
 * We normalize them so old local env files do not break the live interview flow.
 */
const LEGACY_MOCK_INTERVIEW_LIVE_MODEL_ALIASES = new Set(["gpt-realtime-1.5"]);

export function resolveMockInterviewLiveModel(raw?: string | null): string {
  const candidate = raw?.trim();
  if (!candidate) return DEFAULT_MOCK_INTERVIEW_LIVE_MODEL;
  return LEGACY_MOCK_INTERVIEW_LIVE_MODEL_ALIASES.has(candidate)
    ? DEFAULT_MOCK_INTERVIEW_LIVE_MODEL
    : candidate;
}

/** Active live interview provider path for the production voice session. */
export const MOCK_INTERVIEW_LIVE_PROVIDER = "openai_realtime_webrtc";

/**
 * Bump when interviewer or evaluation instructions change (audit trail for mock_interviews.prompt_version).
 */
export const MOCK_INTERVIEW_PIPELINE_VERSION = "2025-03-21-v2";
