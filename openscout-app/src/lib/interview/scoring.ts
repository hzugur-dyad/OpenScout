import { z } from "zod";
import { extractJsonObjectFromModelText } from "@/lib/ai/extract-json";
import { logWarn } from "@/lib/logger";
import type { InterviewLocale } from "@/lib/interview-locale";
import {
  computeDeterministicInterviewOverallScore,
  type InterviewEvidenceQuality,
} from "@/lib/mock-interview/policy";
import type { InterviewDifficulty, InterviewPlannerAction, InterviewVerdict } from "@/services/interview";

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function coerceScore(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return clampScore(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return clampScore(parsed);
  }
  return null;
}

function coerceString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function coerceStringArray(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry).trim())
    .filter(Boolean)
    .slice(0, limit);
}

export type NormalizedInterviewThinkingOutput = {
  action: InterviewPlannerAction;
  spokenPrompt: string;
  nextQuestion: string;
  followUp: string | null;
  assessmentFocus: string;
  evaluationHint: string;
  difficulty: InterviewDifficulty;
  isOffTopic: boolean;
  closingReason: string | null;
  usedFallback: boolean;
};

const interviewThinkingSchema = z
  .object({
    action: z.enum(["advance", "follow_up", "close"]).optional(),
    spokenPrompt: z.string().optional(),
    nextQuestion: z.string().optional(),
    followUp: z.union([z.string(), z.null()]).optional(),
    assessmentFocus: z.string().optional(),
    evaluationHint: z.string().optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    isOffTopic: z.boolean().optional(),
    closingReason: z.union([z.string(), z.null()]).optional(),
  })
  .passthrough();

export function parseInterviewThinkingModelOutput(rawModelText: string): NormalizedInterviewThinkingOutput {
  let raw: unknown = {};
  try {
    raw = JSON.parse(extractJsonObjectFromModelText(rawModelText));
  } catch {
    logWarn("mock-interview thinking: invalid JSON, using fallback");
    return {
      action: "advance",
      spokenPrompt: "",
      nextQuestion: "",
      followUp: null,
      assessmentFocus: "",
      evaluationHint: "",
      difficulty: "medium",
      isOffTopic: false,
      closingReason: null,
      usedFallback: true,
    };
  }

  const parsed = interviewThinkingSchema.safeParse(raw);
  if (!parsed.success) {
    logWarn("mock-interview thinking: schema mismatch, using fallback");
    return {
      action: "advance",
      spokenPrompt: "",
      nextQuestion: "",
      followUp: null,
      assessmentFocus: "",
      evaluationHint: "",
      difficulty: "medium",
      isOffTopic: false,
      closingReason: null,
      usedFallback: true,
    };
  }

  const spokenPrompt = coerceString(parsed.data.spokenPrompt);
  const nextQuestion = coerceString(parsed.data.nextQuestion);
  const followUp = coerceString(parsed.data.followUp) || null;
  const action =
    parsed.data.action ??
    (followUp ? "follow_up" : spokenPrompt || nextQuestion ? "advance" : "advance");

  return {
    action,
    spokenPrompt: spokenPrompt || followUp || nextQuestion,
    nextQuestion: nextQuestion || (action === "advance" ? spokenPrompt : ""),
    followUp: action === "follow_up" ? followUp || spokenPrompt || null : followUp,
    assessmentFocus: coerceString(parsed.data.assessmentFocus) || coerceString(parsed.data.evaluationHint),
    evaluationHint: coerceString(parsed.data.evaluationHint),
    difficulty: parsed.data.difficulty ?? "medium",
    isOffTopic: Boolean(parsed.data.isOffTopic),
    closingReason: coerceString(parsed.data.closingReason) || null,
    usedFallback: false,
  };
}

export type NormalizedInterviewScoreOutput = {
  verdict: InterviewVerdict;
  strengths: string[];
  weaknesses: string[];
  communication: number;
  technical: number;
  roleFit: number;
  problemSolving: number | null;
  evidenceQuality: InterviewEvidenceQuality;
  summary: string;
  usedFallback: boolean;
};

function coerceEvidenceQuality(value: unknown): InterviewEvidenceQuality | null {
  if (typeof value !== "string") return null;
  if (value === "low" || value === "medium" || value === "high") return value;
  return null;
}

const interviewScoreSchema = z
  .object({
    score: z.union([z.number(), z.string()]).optional(),
    overall_score: z.union([z.number(), z.string()]).optional(),
    verdict: z.enum(["strong hire", "hire", "no hire"]).optional(),
    strengths: z.array(z.union([z.string(), z.number()])).optional(),
    weaknesses: z.array(z.union([z.string(), z.number()])).optional(),
    improvements: z.array(z.union([z.string(), z.number()])).optional(),
    communication: z.union([z.number(), z.string()]).optional(),
    communication_score: z.union([z.number(), z.string()]).optional(),
    technical: z.union([z.number(), z.string()]).optional(),
    technical_score: z.union([z.number(), z.string()]).optional(),
    problemSolving: z.union([z.number(), z.string()]).optional(),
    problem_solving_score: z.union([z.number(), z.string()]).optional(),
    roleFit: z.union([z.number(), z.string()]).optional(),
    role_fit_score: z.union([z.number(), z.string()]).optional(),
    summary: z.string().optional(),
    justification: z.string().optional(),
    evidence_quality: z.enum(["low", "medium", "high"]).optional(),
    evidenceQuality: z.enum(["low", "medium", "high"]).optional(),
  })
  .passthrough();

export function deriveInterviewVerdict(score: number): InterviewVerdict {
  if (score >= 85) return "strong hire";
  if (score >= 70) return "hire";
  return "no hire";
}

export function parseInterviewScoreModelOutput(rawModelText: string): NormalizedInterviewScoreOutput {
  let raw: unknown = {};
  try {
    raw = JSON.parse(extractJsonObjectFromModelText(rawModelText));
  } catch {
    logWarn("mock-interview score: invalid JSON, using fallback");
    return {
      verdict: deriveInterviewVerdict(50),
      strengths: ["Participation recorded; detailed strengths unavailable for this run."],
      weaknesses: ["Retry the interview summary if you need a full evaluation."],
      communication: 50,
      technical: 50,
      roleFit: 50,
      problemSolving: null,
      evidenceQuality: "low",
      summary: "The evaluation service returned data that could not be parsed. A neutral score was applied.",
      usedFallback: true,
    };
  }

  const parsed = interviewScoreSchema.safeParse(raw);
  if (!parsed.success) {
    logWarn("mock-interview score: schema mismatch, using fallback");
    return {
      verdict: deriveInterviewVerdict(50),
      strengths: ["Participation recorded; detailed strengths unavailable for this run."],
      weaknesses: ["Retry the interview summary if you need a full evaluation."],
      communication: 50,
      technical: 50,
      roleFit: 50,
      problemSolving: null,
      evidenceQuality: "low",
      summary: "The evaluation service returned data that could not be parsed. A neutral score was applied.",
      usedFallback: true,
    };
  }

  const communication =
    coerceScore(parsed.data.communication) ??
    coerceScore(parsed.data.communication_score) ??
    50;
  const technical =
    coerceScore(parsed.data.technical) ??
    coerceScore(parsed.data.technical_score) ??
    50;
  const problemSolving =
    coerceScore(parsed.data.problemSolving) ??
    coerceScore(parsed.data.problem_solving_score);
  const roleFit =
    coerceScore(parsed.data.roleFit) ??
    coerceScore(parsed.data.role_fit_score) ??
    50;
  const computedScore = computeDeterministicInterviewOverallScore({
    technical,
    problemSolving: problemSolving ?? 50,
    communication,
    roleFit,
  });

  return {
    verdict: parsed.data.verdict ?? deriveInterviewVerdict(computedScore),
    strengths: coerceStringArray(parsed.data.strengths),
    weaknesses: coerceStringArray(parsed.data.weaknesses).length
      ? coerceStringArray(parsed.data.weaknesses)
      : coerceStringArray(parsed.data.improvements),
    communication,
    technical,
    roleFit,
    problemSolving,
    evidenceQuality:
      coerceEvidenceQuality(parsed.data.evidence_quality) ??
      coerceEvidenceQuality(parsed.data.evidenceQuality) ??
      "medium",
    summary: coerceString(parsed.data.summary) || coerceString(parsed.data.justification),
    usedFallback: false,
  };
}

export function localizeInterviewVerdict(verdict: InterviewVerdict, locale: InterviewLocale): string {
  if (locale === "tr") {
    if (verdict === "strong hire") return "Guclu ise alim";
    if (verdict === "hire") return "Ise alim";
    return "Ise alim yok";
  }
  if (verdict === "strong hire") return "Strong hire";
  if (verdict === "hire") return "Hire";
  return "No hire";
}
