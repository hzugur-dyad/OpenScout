/**
 * Rule-based risk / confidence flags for employer views (no ML).
 */

export type CandidateRiskFlag =
  | "evaluation_fallback"
  | "missing_subscores"
  | "dimension_spread"
  | "short_interview"
  | "cv_below_bar";

export type RiskInput = {
  interviewReport: unknown;
  interviewScore: number | null;
  cvScore: number | null;
  minCvScore: number | null;
  /** When known (mock_interviews.duration_ms or client) */
  durationMs: number | null;
};

const SHORT_INTERVIEW_MS = 5 * 60 * 1000;
const SPREAD_THRESHOLD = 28;

export function computeCandidateRiskFlags(input: RiskInput): CandidateRiskFlag[] {
  const flags: CandidateRiskFlag[] = [];
  const r = input.interviewReport as {
    evaluation_meta?: { used_fallback?: boolean };
    technical_score?: unknown;
    communication_score?: unknown;
    problem_solving_score?: unknown;
  } | null;

  if (r?.evaluation_meta?.used_fallback) flags.push("evaluation_fallback");

  const t = typeof r?.technical_score === "number" ? r.technical_score : null;
  const c = typeof r?.communication_score === "number" ? r.communication_score : null;
  const p = typeof r?.problem_solving_score === "number" ? r.problem_solving_score : null;
  if ([t, c, p].some((x) => x === null)) flags.push("missing_subscores");

  const nums = [t, c, p].filter((x): x is number => typeof x === "number");
  if (nums.length >= 2) {
    const spread = Math.max(...nums) - Math.min(...nums);
    if (spread >= SPREAD_THRESHOLD) flags.push("dimension_spread");
  }

  if (typeof input.durationMs === "number" && input.durationMs > 0 && input.durationMs < SHORT_INTERVIEW_MS) {
    flags.push("short_interview");
  }

  if (
    typeof input.cvScore === "number" &&
    typeof input.minCvScore === "number" &&
    input.minCvScore > 0 &&
    input.cvScore < input.minCvScore
  ) {
    flags.push("cv_below_bar");
  }

  return flags;
}

export function riskFlagLabel(flag: CandidateRiskFlag): string {
  switch (flag) {
    case "evaluation_fallback":
      return "Low confidence scoring";
    case "missing_subscores":
      return "Incomplete score breakdown";
    case "dimension_spread":
      return "Uneven skills vs communication";
    case "short_interview":
      return "Short interview session";
    case "cv_below_bar":
      return "CV below job minimum";
    default:
      return flag;
  }
}
