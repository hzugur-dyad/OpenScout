/**
 * Deterministic employer decision support from stored application + interview report (no LLM).
 */

import {
  computeHiringScore,
  hiringFitTagFromScore,
  hiringScoreInputsFromInterviewRow,
  type HiringFitTag,
} from "@/lib/hiring-score";
import type { RecommendationInputs } from "@/lib/ai-recommendation-reason";

const SHORT_INTERVIEW_MS = 5 * 60 * 1000;
const DIM_SPREAD_INCONSISTENT = 24;
const WEAK_DIM = 58;
const SURFACE_GAP = 14; // overall interview vs sub-score gap → possible surface-level answers

export type ScoreDimension = "technical" | "communication" | "problem_solving";

export type EmployerDecisionRiskFlag =
  | "low_confidence"
  | "inconsistent_answers"
  | "weak_technical_depth"
  | "weak_communication"
  | "weak_problem_solving"
  | "cv_below_minimum"
  | "short_interview"
  | "incomplete_score_breakdown";

export type EmployerIntelligenceContext = {
  minCvScore: number | null;
  durationMs: number | null;
};

export type EmployerIntelligenceRow = {
  cv_score: number | null;
  interview_score: number | null;
  interview_report: unknown;
  ai_recommendation_reason?: string | null;
};

type ParsedReport = {
  technical: number | null;
  communication: number | null;
  problemSolving: number | null;
  /** Present only if stored on report (optional future / manual fields) */
  confidenceScore: number | null;
  consistencyScore: number | null;
  evaluationMeta: { used_fallback?: boolean; transcript_signal?: string } | undefined;
};

function parseInterviewReport(report: unknown): ParsedReport {
  const r = report as Record<string, unknown> | null;
  if (!r || typeof r !== "object") {
    return {
      technical: null,
      communication: null,
      problemSolving: null,
      confidenceScore: null,
      consistencyScore: null,
      evaluationMeta: undefined,
    };
  }
  const num = (k: string): number | null => {
    const v = r[k];
    return typeof v === "number" && !Number.isNaN(v) ? v : null;
  };
  const meta = r.evaluation_meta;
  const evaluationMeta =
    meta && typeof meta === "object"
      ? (meta as { used_fallback?: boolean; transcript_signal?: string })
      : undefined;

  return {
    technical: num("technical_score"),
    communication: num("communication_score"),
    problemSolving: num("problem_solving_score"),
    confidenceScore: num("confidence_score") ?? num("session_confidence") ?? num("live_confidence"),
    consistencyScore: num("consistency_score") ?? num("session_consistency"),
    evaluationMeta,
  };
}

function numericDims(p: ParsedReport): number[] {
  return [p.technical, p.communication, p.problemSolving].filter((x): x is number => typeof x === "number");
}

const DIM_LABEL: Record<ScoreDimension, string> = {
  technical: "Technical",
  communication: "Communication",
  problem_solving: "Problem solving",
};

export function computeDimensionExtremes(report: unknown): {
  strongest: { key: ScoreDimension; label: string; score: number } | null;
  weakest: { key: ScoreDimension; label: string; score: number } | null;
} {
  const p = parseInterviewReport(report);
  const entries: { key: ScoreDimension; score: number }[] = [];
  if (typeof p.technical === "number") entries.push({ key: "technical", score: p.technical });
  if (typeof p.communication === "number") entries.push({ key: "communication", score: p.communication });
  if (typeof p.problemSolving === "number") entries.push({ key: "problem_solving", score: p.problemSolving });
  if (entries.length === 0) return { strongest: null, weakest: null };
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  const hi = sorted[0];
  const lo = sorted[sorted.length - 1];
  return {
    strongest: { key: hi.key, label: DIM_LABEL[hi.key], score: hi.score },
    weakest: { key: lo.key, label: DIM_LABEL[lo.key], score: lo.score },
  };
}

export function computeEmployerDecisionRiskFlags(
  row: EmployerIntelligenceRow,
  ctx: EmployerIntelligenceContext
): EmployerDecisionRiskFlag[] {
  const flags: EmployerDecisionRiskFlag[] = [];
  const p = parseInterviewReport(row.interview_report);
  const interviewScore = typeof row.interview_score === "number" ? row.interview_score : null;
  const dims = numericDims(p);

  if (p.evaluationMeta?.used_fallback) flags.push("low_confidence");
  if (p.evaluationMeta?.transcript_signal === "low") flags.push("low_confidence");

  if (typeof p.confidenceScore === "number" && p.confidenceScore < 52) flags.push("low_confidence");
  if (typeof p.consistencyScore === "number" && p.consistencyScore < 52) flags.push("inconsistent_answers");

  if (dims.length >= 2) {
    const spread = Math.max(...dims) - Math.min(...dims);
    if (spread >= DIM_SPREAD_INCONSISTENT) flags.push("inconsistent_answers");
  }

  if (interviewScore === null && row.cv_score != null) flags.push("low_confidence");

  const presentCount = [p.technical, p.communication, p.problemSolving].filter((x) => typeof x === "number").length;
  if (typeof interviewScore === "number" && presentCount < 2) flags.push("incomplete_score_breakdown");

  if (typeof p.technical === "number") {
    if (p.technical < WEAK_DIM) flags.push("weak_technical_depth");
    else if (
      interviewScore !== null &&
      interviewScore >= 62 &&
      p.technical < interviewScore - SURFACE_GAP
    ) {
      flags.push("weak_technical_depth");
    }
  }

  if (typeof p.communication === "number") {
    if (p.communication < WEAK_DIM) flags.push("weak_communication");
    else if (
      interviewScore !== null &&
      interviewScore >= 62 &&
      p.communication < interviewScore - SURFACE_GAP
    ) {
      flags.push("weak_communication");
    }
  }

  if (typeof p.problemSolving === "number") {
    if (p.problemSolving < WEAK_DIM) flags.push("weak_problem_solving");
    else if (
      interviewScore !== null &&
      interviewScore >= 62 &&
      p.problemSolving < interviewScore - SURFACE_GAP
    ) {
      flags.push("weak_problem_solving");
    }
  }

  if (
    typeof row.cv_score === "number" &&
    typeof ctx.minCvScore === "number" &&
    ctx.minCvScore > 0 &&
    row.cv_score < ctx.minCvScore
  ) {
    flags.push("cv_below_minimum");
  }

  if (typeof ctx.durationMs === "number" && ctx.durationMs > 0 && ctx.durationMs < SHORT_INTERVIEW_MS) {
    flags.push("short_interview");
  }

  return [...new Set(flags)];
}

export function employerDecisionRiskFlagLabel(flag: EmployerDecisionRiskFlag): string {
  switch (flag) {
    case "low_confidence":
      return "Low confidence";
    case "inconsistent_answers":
      return "Inconsistent answers";
    case "weak_technical_depth":
      return "Weak technical depth";
    case "weak_communication":
      return "Weak communication";
    case "weak_problem_solving":
      return "Weak problem solving";
    case "cv_below_minimum":
      return "CV below job minimum";
    case "short_interview":
      return "Short interview session";
    case "incomplete_score_breakdown":
      return "Incomplete score breakdown";
    default:
      return flag;
  }
}

function recommendationInputsFromRow(
  row: EmployerIntelligenceRow,
  minCvScore: number | null
): RecommendationInputs {
  const p = parseInterviewReport(row.interview_report);
  return {
    cvScore: row.cv_score,
    interviewScore: row.interview_score,
    technical: p.technical,
    communication: p.communication,
    problemSolving: p.problemSolving,
    minCvScore: minCvScore ?? undefined,
  };
}

/** One-line copy when no stored reason (or as fallback). */
export function computeEmployerRecommendationOneLiner(input: RecommendationInputs): string {
  const { interviewScore: o, technical: t, communication: c, problemSolving: p } = input;
  const dims = [t, c, p].filter((x): x is number => typeof x === "number");

  if (dims.length >= 2) {
    if (typeof t === "number" && typeof c === "number" && t >= 72 && c >= 70 && (p === null || p >= 58)) {
      return "Strong technical performance with clear communication.";
    }
    if (
      typeof o === "number" &&
      o >= 65 &&
      typeof p === "number" &&
      p < 62 &&
      (t === null || p <= t - 6) &&
      (c === null || p <= c - 6)
    ) {
      return "Good overall fit but weaker problem-solving depth.";
    }
    if (typeof t === "number" && t < 58) {
      return "Needs stronger technical fundamentals.";
    }
    if (typeof c === "number" && c < 58) {
      return "Communication clarity needs strengthening for this role.";
    }
    const spread = Math.max(...dims) - Math.min(...dims);
    if (spread >= 22) {
      return "Uneven profile across interview dimensions — review the detailed report.";
    }
  }

  if (typeof o === "number") {
    if (o >= 78) return "Strong overall interview signal.";
    if (o >= 65) return "Solid interview performance; confirm depth where the role is demanding.";
    if (o >= 50) return "Mixed interview signal — verify priorities in a live screen.";
    return "Interview signal is below typical bar — probe fundamentals before advancing.";
  }

  return "Limited interview data — review CV and invite to interview if the profile fits.";
}

export function resolveEmployerRecommendationReason(
  stored: string | null | undefined,
  row: EmployerIntelligenceRow,
  minCvScore: number | null
): string {
  const trimmed = typeof stored === "string" ? stored.trim() : "";
  if (trimmed) {
    const firstSentence = trimmed.split(/(?<=[.!?])\s+/)[0]?.trim() ?? trimmed;
    if (firstSentence.length <= 160) {
      return firstSentence.endsWith(".") || firstSentence.endsWith("!") || firstSentence.endsWith("?")
        ? firstSentence
        : `${firstSentence}.`;
    }
    return `${trimmed.slice(0, 157)}…`;
  }
  return computeEmployerRecommendationOneLiner(recommendationInputsFromRow(row, minCvScore));
}

export type EmployerIntelligence = {
  hiringScore: number;
  fitLabel: HiringFitTag;
  recommendationReason: string;
  riskFlags: EmployerDecisionRiskFlag[];
  riskCount: number;
  strongestDimension: { key: ScoreDimension; label: string; score: number } | null;
  weakestDimension: { key: ScoreDimension; label: string; score: number } | null;
};

export function getEmployerIntelligence(
  row: EmployerIntelligenceRow,
  ctx: EmployerIntelligenceContext
): EmployerIntelligence {
  const hiringScore = computeHiringScore(hiringScoreInputsFromInterviewRow(row));
  const fitLabel = hiringFitTagFromScore(hiringScore);
  const riskFlags = computeEmployerDecisionRiskFlags(row, ctx);
  const { strongest, weakest } = computeDimensionExtremes(row.interview_report);
  const recommendationReason = resolveEmployerRecommendationReason(row.ai_recommendation_reason, row, ctx.minCvScore);

  return {
    hiringScore,
    fitLabel,
    recommendationReason,
    riskFlags,
    riskCount: riskFlags.length,
    strongestDimension: strongest,
    weakestDimension: weakest,
  };
}

/** Higher = more trustworthy / stronger signal (for sorting). */
export function employerConfidenceSortKey(row: EmployerIntelligenceRow, ctx: EmployerIntelligenceContext): number {
  const p = parseInterviewReport(row.interview_report);
  let base: number;
  const dims = numericDims(p);
  if (dims.length > 0) {
    base = dims.reduce((a, b) => a + b, 0) / dims.length;
  } else {
    base = typeof row.interview_score === "number" ? row.interview_score : 0;
  }
  if (p.evaluationMeta?.used_fallback) base -= 35;
  if (p.evaluationMeta?.transcript_signal === "low") base -= 22;
  if (typeof p.confidenceScore === "number") base = base * 0.5 + p.confidenceScore * 0.5;
  return base;
}

/** Higher = more consistent dimensions (for sorting). */
export function employerConsistencySortKey(row: EmployerIntelligenceRow): number {
  const p = parseInterviewReport(row.interview_report);
  const dims = numericDims(p);
  if (dims.length < 2) return -1000;
  const spread = Math.max(...dims) - Math.min(...dims);
  let key = 100 - spread;
  if (typeof p.consistencyScore === "number") key = key * 0.5 + p.consistencyScore * 0.5;
  return key;
}

export function employerProblemSolvingSortKey(row: EmployerIntelligenceRow): number | null {
  const p = parseInterviewReport(row.interview_report);
  return typeof p.problemSolving === "number" ? p.problemSolving : null;
}

/** Dashboard / compare: single-line explanation next to “top” hire. */
export function buildTopCandidateSummaryLine(row: EmployerIntelligenceRow, ctx: EmployerIntelligenceContext): string {
  const intel = getEmployerIntelligence(row, ctx);
  const p = parseInterviewReport(row.interview_report);

  if (
    typeof p.technical === "number" &&
    p.technical >= 72 &&
    typeof p.communication === "number" &&
    p.communication >= 70
  ) {
    return "Top candidate due to strong technical and communication scores.";
  }
  if (intel.riskCount === 0 && intel.hiringScore >= 75) {
    return "Top candidate by hiring score with no automated risk flags.";
  }
  if (intel.strongestDimension?.key === "technical" && (p.technical ?? 0) >= 68) {
    return "Top candidate — strongest technical depth in this pool.";
  }
  if (intel.strongestDimension?.key === "communication" && (p.communication ?? 0) >= 68) {
    return "Top candidate — clearest communication in this pool.";
  }
  return `Top candidate by blended hiring score (${intel.hiringScore}).`;
}

export { computeAiRecommendationReason } from "@/lib/ai-recommendation-reason";
