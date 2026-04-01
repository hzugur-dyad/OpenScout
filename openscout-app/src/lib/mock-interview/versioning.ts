/** Fast Groq model used for per-turn interviewer reasoning. */
export const DEFAULT_GROQ_MOCK_INTERVIEW_THINKING_MODEL = "llama-3.1-8b-instant";

/** Higher-quality Groq model used for final interview scoring. */
export const DEFAULT_GROQ_MOCK_INTERVIEW_SCORING_MODEL = "llama-3.3-70b-versatile";

export function resolveGroqMockInterviewThinkingModel(raw?: string | null): string {
  const candidate = raw?.trim();
  return candidate || DEFAULT_GROQ_MOCK_INTERVIEW_THINKING_MODEL;
}

export function resolveGroqMockInterviewScoringModel(raw?: string | null): string {
  const candidate = raw?.trim();
  return candidate || DEFAULT_GROQ_MOCK_INTERVIEW_SCORING_MODEL;
}

export const GROQ_MOCK_INTERVIEW_THINKING_MODEL = resolveGroqMockInterviewThinkingModel(
  process.env.GROQ_MOCK_INTERVIEW_THINKING_MODEL ?? process.env.GROQ_MOCK_INTERVIEW_MODEL
);

export const GROQ_MOCK_INTERVIEW_SCORING_MODEL = resolveGroqMockInterviewScoringModel(
  process.env.GROQ_MOCK_INTERVIEW_SCORING_MODEL ?? process.env.GROQ_MOCK_INTERVIEW_MODEL
);

/**
 * Legacy alias retained for older routes/tests that still expect a single interview model constant.
 * In the dual-model pipeline this maps to the scoring model.
 */
export const GROQ_MOCK_INTERVIEW_MODEL = GROQ_MOCK_INTERVIEW_SCORING_MODEL;

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
export const MOCK_INTERVIEW_PIPELINE_VERSION = "2026-04-01-v3-dual-model";
