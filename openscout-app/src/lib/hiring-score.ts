/**
 * Deterministic hiring score for employer views (no LLM).
 * Combines interview overall + report sub-scores with fixed weights; missing inputs use weight renormalization.
 */

export type HiringScoreInputs = {
  overall_score: number | null;
  technical_score: number | null;
  communication_score: number | null;
  problem_solving_score: number | null;
};

const W = {
  overall: 0.4,
  technical: 0.3,
  communication: 0.2,
  problem_solving: 0.1,
} as const;

type Key = keyof typeof W;

function clamp0to100(n: number): number {
  return Math.min(100, Math.max(0, n));
}

/** Renormalize weights over only the dimensions that have numeric scores. */
export function computeHiringScore(inputs: HiringScoreInputs): number {
  const pairs: { key: Key; value: number }[] = [];
  if (typeof inputs.overall_score === "number" && !Number.isNaN(inputs.overall_score)) {
    pairs.push({ key: "overall", value: clamp0to100(inputs.overall_score) });
  }
  if (typeof inputs.technical_score === "number" && !Number.isNaN(inputs.technical_score)) {
    pairs.push({ key: "technical", value: clamp0to100(inputs.technical_score) });
  }
  if (typeof inputs.communication_score === "number" && !Number.isNaN(inputs.communication_score)) {
    pairs.push({ key: "communication", value: clamp0to100(inputs.communication_score) });
  }
  if (typeof inputs.problem_solving_score === "number" && !Number.isNaN(inputs.problem_solving_score)) {
    pairs.push({ key: "problem_solving", value: clamp0to100(inputs.problem_solving_score) });
  }

  if (pairs.length === 0) return 0;

  const wSum = pairs.reduce((s, p) => s + W[p.key], 0);
  if (wSum <= 0) return 0;

  const blended = pairs.reduce((s, p) => s + p.value * (W[p.key] / wSum), 0);
  return Math.round(clamp0to100(blended));
}

export function hiringScoreInputsFromInterviewRow(row: {
  interview_score: number | null;
  interview_report: unknown;
}): HiringScoreInputs {
  const r = row.interview_report as {
    technical_score?: unknown;
    communication_score?: unknown;
    problem_solving_score?: unknown;
  } | null;
  return {
    overall_score: typeof row.interview_score === "number" ? row.interview_score : null,
    technical_score: typeof r?.technical_score === "number" ? r.technical_score : null,
    communication_score: typeof r?.communication_score === "number" ? r.communication_score : null,
    problem_solving_score: typeof r?.problem_solving_score === "number" ? r.problem_solving_score : null,
  };
}

export type HiringFitTag = "Strong Fit" | "Good Fit" | "Average" | "Weak Fit";

export function hiringFitTagFromScore(hiringScore: number): HiringFitTag {
  if (hiringScore >= 90) return "Strong Fit";
  if (hiringScore >= 75) return "Good Fit";
  if (hiringScore >= 60) return "Average";
  return "Weak Fit";
}
