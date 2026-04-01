import { z } from "zod";
import { extractJsonObjectFromModelText } from "@/lib/ai/extract-json";
import { logWarn } from "@/lib/logger";
import type { InterviewLocale } from "@/lib/interview-locale";
import type { InterviewDifficulty, InterviewVerdict } from "@/services/interview";

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
  nextQuestion: string;
  followUp: string | null;
  evaluationHint: string;
  difficulty: InterviewDifficulty;
  isOffTopic: boolean;
  usedFallback: boolean;
};

const interviewThinkingSchema = z
  .object({
    nextQuestion: z.string().optional(),
    followUp: z.union([z.string(), z.null()]).optional(),
    evaluationHint: z.string().optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    isOffTopic: z.boolean().optional(),
  })
  .passthrough();

export function parseInterviewThinkingModelOutput(rawModelText: string): NormalizedInterviewThinkingOutput {
  let raw: unknown = {};
  try {
    raw = JSON.parse(extractJsonObjectFromModelText(rawModelText));
  } catch {
    logWarn("mock-interview thinking: invalid JSON, using fallback");
    return {
      nextQuestion: "",
      followUp: null,
      evaluationHint: "",
      difficulty: "medium",
      isOffTopic: false,
      usedFallback: true,
    };
  }

  const parsed = interviewThinkingSchema.safeParse(raw);
  if (!parsed.success) {
    logWarn("mock-interview thinking: schema mismatch, using fallback");
    return {
      nextQuestion: "",
      followUp: null,
      evaluationHint: "",
      difficulty: "medium",
      isOffTopic: false,
      usedFallback: true,
    };
  }

  return {
    nextQuestion: coerceString(parsed.data.nextQuestion),
    followUp: coerceString(parsed.data.followUp) || null,
    evaluationHint: coerceString(parsed.data.evaluationHint),
    difficulty: parsed.data.difficulty ?? "medium",
    isOffTopic: Boolean(parsed.data.isOffTopic),
    usedFallback: false,
  };
}

export type NormalizedInterviewScoreOutput = {
  score: number;
  verdict: InterviewVerdict;
  strengths: string[];
  weaknesses: string[];
  communication: number;
  technical: number;
  problemSolving: number | null;
  summary: string;
  usedFallback: boolean;
};

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
    summary: z.string().optional(),
    justification: z.string().optional(),
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
    const score = 50;
    return {
      score,
      verdict: deriveInterviewVerdict(score),
      strengths: ["Participation recorded; detailed strengths unavailable for this run."],
      weaknesses: ["Retry the interview summary if you need a full evaluation."],
      communication: 50,
      technical: 50,
      problemSolving: null,
      summary: "The evaluation service returned data that could not be parsed. A neutral score was applied.",
      usedFallback: true,
    };
  }

  const parsed = interviewScoreSchema.safeParse(raw);
  if (!parsed.success) {
    logWarn("mock-interview score: schema mismatch, using fallback");
    const score = 50;
    return {
      score,
      verdict: deriveInterviewVerdict(score),
      strengths: ["Participation recorded; detailed strengths unavailable for this run."],
      weaknesses: ["Retry the interview summary if you need a full evaluation."],
      communication: 50,
      technical: 50,
      problemSolving: null,
      summary: "The evaluation service returned data that could not be parsed. A neutral score was applied.",
      usedFallback: true,
    };
  }

  const score = coerceScore(parsed.data.score) ?? coerceScore(parsed.data.overall_score) ?? 50;
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

  return {
    score,
    verdict: parsed.data.verdict ?? deriveInterviewVerdict(score),
    strengths: coerceStringArray(parsed.data.strengths),
    weaknesses: coerceStringArray(parsed.data.weaknesses).length
      ? coerceStringArray(parsed.data.weaknesses)
      : coerceStringArray(parsed.data.improvements),
    communication,
    technical,
    problemSolving,
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
