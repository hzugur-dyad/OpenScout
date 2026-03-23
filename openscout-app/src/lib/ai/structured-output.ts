import { z } from "zod";
import { extractJsonObjectFromModelText, extractTrailingJsonObject, stripTrailingJsonSlice } from "@/lib/ai/extract-json";
import { logWarn } from "@/lib/logger";

const CATEGORY_KEYS = [
  "professional_summary",
  "work_experience",
  "skills",
  "education",
  "online_presence",
  "highlights",
] as const;

export type CvCategoryKey = (typeof CATEGORY_KEYS)[number];

function clampScore(n: number): number {
  return Math.round(Math.min(100, Math.max(0, Number(n))));
}

function coerceScore(v: unknown): number | undefined {
  if (typeof v === "number" && !Number.isNaN(v)) return clampScore(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (!Number.isNaN(n)) return clampScore(n);
  }
  return undefined;
}

const cvHolderLooseSchema = z
  .object({
    full_name: z.string().optional(),
    current_role: z.string().optional(),
    department_or_field: z.string().optional(),
    location: z.string().optional(),
    email: z.string().optional(),
    summary_line: z.string().optional(),
  })
  .passthrough();

const cvAnalysisLooseSchema = z
  .object({
    cv_holder: cvHolderLooseSchema.optional(),
    category_scores: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
    category_feedback: z.record(z.string(), z.string()).optional(),
    detailed_report: z.string().optional(),
    strengths: z.array(z.union([z.string(), z.number()])).optional(),
    improvements: z.array(z.union([z.string(), z.number()])).optional(),
  })
  .passthrough();

export type NormalizedCvAnalysisResult = {
  cv_holder: {
    full_name: string;
    current_role: string;
    department_or_field: string;
    location: string;
    email: string;
    summary_line: string;
  };
  overall_score: number;
  category_scores: Record<string, number>;
  category_feedback: Record<string, string>;
  detailed_report: string;
  strengths: string[];
  improvements: string[];
  usedFallback: boolean;
};

function emptyCvHolder() {
  return {
    full_name: "",
    current_role: "",
    department_or_field: "",
    location: "",
    email: "",
    summary_line: "",
  };
}

function defaultCategoryScores(): Record<string, number> {
  const o: Record<string, number> = {};
  for (const k of CATEGORY_KEYS) o[k] = 50;
  return o;
}

function computeOverallScore(categoryScores: Record<string, number>, weights: Record<string, number>): number {
  let sum = 0;
  let totalWeight = 0;
  for (const key of CATEGORY_KEYS) {
    const v = categoryScores[key];
    if (typeof v === "number" && !Number.isNaN(v)) {
      sum += clampScore(v) * (weights[key] ?? 0.1);
      totalWeight += weights[key] ?? 0.1;
    }
  }
  if (totalWeight <= 0) return 50;
  return Math.round(sum / totalWeight);
}

const DEFAULT_WEIGHTS: Record<string, number> = {
  professional_summary: 0.15,
  work_experience: 0.3,
  skills: 0.25,
  education: 0.15,
  online_presence: 0.05,
  highlights: 0.1,
};

/** Full CV analysis (manual route): normalize model JSON or return safe defaults. */
export function parseCvAnalysisModelOutput(
  rawModelText: string,
  weights: Record<string, number> = DEFAULT_WEIGHTS
): NormalizedCvAnalysisResult {
  const jsonStr = extractJsonObjectFromModelText(rawModelText);
  let raw: unknown;
  try {
    raw = JSON.parse(jsonStr);
  } catch {
    logWarn("cv-analysis: invalid JSON from model, using fallback", { preview: rawModelText.slice(0, 120) });
    return buildFullCvFallback(true);
  }

  const parsed = cvAnalysisLooseSchema.safeParse(raw);
  if (!parsed.success) {
    logWarn("cv-analysis: schema mismatch, using fallback", { issues: parsed.error.issues.slice(0, 5) });
    return buildFullCvFallback(true);
  }

  const d = parsed.data;
  const h = d.cv_holder ?? {};
  const cv_holder = {
    full_name: typeof h.full_name === "string" ? h.full_name.trim() : "",
    current_role: typeof h.current_role === "string" ? h.current_role.trim() : "",
    department_or_field: typeof h.department_or_field === "string" ? h.department_or_field.trim() : "",
    location: typeof h.location === "string" ? h.location.trim() : "",
    email: typeof h.email === "string" ? h.email.trim() : "",
    summary_line: typeof h.summary_line === "string" ? h.summary_line.trim() : "",
  };

  const category_scores: Record<string, number> = {};
  for (const k of CATEGORY_KEYS) {
    const v = d.category_scores?.[k];
    category_scores[k] = coerceScore(v) ?? 50;
  }
  const overall_score = computeOverallScore(category_scores, weights);

  const strengths = Array.isArray(d.strengths)
    ? d.strengths.map((s) => String(s)).filter(Boolean).slice(0, 5)
    : [];
  const improvements = Array.isArray(d.improvements)
    ? d.improvements.map((s) => String(s)).filter(Boolean).slice(0, 5)
    : [];

  const category_feedback: Record<string, string> = {};
  for (const k of CATEGORY_KEYS) {
    const v = d.category_feedback?.[k];
    category_feedback[k] = typeof v === "string" ? v.trim() : "";
  }
  const detailed_report = typeof d.detailed_report === "string" ? d.detailed_report.trim() : "";

  return {
    cv_holder,
    overall_score,
    category_scores,
    category_feedback,
    detailed_report,
    strengths,
    improvements,
    usedFallback: false,
  };
}

function buildFullCvFallback(fromError: boolean): NormalizedCvAnalysisResult {
  const category_scores = defaultCategoryScores();
  return {
    cv_holder: emptyCvHolder(),
    overall_score: 50,
    category_scores,
    category_feedback: Object.fromEntries(CATEGORY_KEYS.map((k) => [k, ""])) as Record<string, string>,
    detailed_report: fromError
      ? "Automated scoring could not be read from the model response. Scores default to neutral; please run analysis again for full detail."
      : "",
    strengths: fromError
      ? ["Analysis completed with neutral defaults due to a parsing issue."]
      : [],
    improvements: fromError
      ? ["Try uploading the CV again or contact support if this persists."]
      : [],
    usedFallback: fromError,
  };
}

const autoCvLooseSchema = z
  .object({
    category_scores: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
    strengths: z.array(z.union([z.string(), z.number()])).optional(),
    improvements: z.array(z.union([z.string(), z.number()])).optional(),
  })
  .passthrough();

export type NormalizedAutoCvResult = {
  category_scores: Record<string, number>;
  overall_score: number;
  strengths: string[];
  improvements: string[];
  usedFallback: boolean;
};

export function parseAutoCvAnalysisModelOutput(
  rawModelText: string,
  weights: Record<string, number> = DEFAULT_WEIGHTS
): NormalizedAutoCvResult {
  const jsonStr = extractJsonObjectFromModelText(rawModelText);
  let raw: unknown;
  try {
    raw = JSON.parse(jsonStr);
  } catch {
    logWarn("cv-analysis/auto: invalid JSON, using fallback", { preview: rawModelText.slice(0, 120) });
    return {
      category_scores: defaultCategoryScores(),
      overall_score: 50,
      strengths: [],
      improvements: ["Re-run analysis; the model response was not valid JSON."],
      usedFallback: true,
    };
  }

  const parsed = autoCvLooseSchema.safeParse(raw);
  if (!parsed.success) {
    logWarn("cv-analysis/auto: schema mismatch, using fallback");
    return {
      category_scores: defaultCategoryScores(),
      overall_score: 50,
      strengths: [],
      improvements: ["Re-run analysis; the response did not match the expected format."],
      usedFallback: true,
    };
  }

  const d = parsed.data;
  const category_scores: Record<string, number> = {};
  for (const k of CATEGORY_KEYS) {
    const v = d.category_scores?.[k];
    category_scores[k] = coerceScore(v) ?? 50;
  }
  const overall_score = computeOverallScore(category_scores, weights);
  const strengths = Array.isArray(d.strengths)
    ? d.strengths.map((s) => String(s)).filter(Boolean).slice(0, 5)
    : [];
  const improvements = Array.isArray(d.improvements)
    ? d.improvements.map((s) => String(s)).filter(Boolean).slice(0, 5)
    : [];

  return {
    category_scores,
    overall_score,
    strengths,
    improvements,
    usedFallback: false,
  };
}

/** Interview evaluation: supports new shape (score, justification, strengths, weaknesses) and legacy fields. */
const interviewEvalLooseSchema = z
  .object({
    score: z.union([z.number(), z.string()]).optional(),
    overall_score: z.union([z.number(), z.string()]).optional(),
    justification: z.string().optional(),
    strengths: z.array(z.union([z.string(), z.number()])).optional(),
    weaknesses: z.array(z.union([z.string(), z.number()])).optional(),
    improvements: z.array(z.union([z.string(), z.number()])).optional(),
    technical_score: z.union([z.number(), z.string()]).optional(),
    communication_score: z.union([z.number(), z.string()]).optional(),
    problem_solving_score: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();

export type NormalizedInterviewEvaluation = {
  overallScore: number;
  justification: string;
  strengths: string[];
  improvements: string[];
  technicalScore: number | null;
  communicationScore: number | null;
  problemSolvingScore: number | null;
  usedFallback: boolean;
};

export function parseInterviewEvaluationModelOutput(rawModelText: string): NormalizedInterviewEvaluation {
  const jsonStr = extractJsonObjectFromModelText(rawModelText);
  let raw: unknown;
  try {
    raw = JSON.parse(jsonStr);
  } catch {
    logWarn("mock-interview result: invalid JSON, using fallback");
    return interviewEvalFallback(true);
  }

  const parsed = interviewEvalLooseSchema.safeParse(raw);
  if (!parsed.success) {
    logWarn("mock-interview result: schema mismatch, using fallback");
    return interviewEvalFallback(true);
  }

  const d = parsed.data;
  const overallScore =
    coerceScore(d.score) ??
    coerceScore(d.overall_score) ??
    50;

  const justification = typeof d.justification === "string" ? d.justification.trim() : "";

  const strengths = Array.isArray(d.strengths)
    ? d.strengths.map((s) => String(s)).filter(Boolean).slice(0, 8)
    : [];

  const fromWeaknesses = Array.isArray(d.weaknesses)
    ? d.weaknesses.map((s) => String(s)).filter(Boolean)
    : [];
  const fromImprovements = Array.isArray(d.improvements)
    ? d.improvements.map((s) => String(s)).filter(Boolean)
    : [];
  const improvements = fromWeaknesses.length > 0 ? fromWeaknesses : fromImprovements;

  const technicalScore = coerceScore(d.technical_score) ?? null;
  const communicationScore = coerceScore(d.communication_score) ?? null;
  const problemSolvingScore = coerceScore(d.problem_solving_score) ?? null;

  return {
    overallScore,
    justification,
    strengths,
    improvements: improvements.slice(0, 8),
    technicalScore,
    communicationScore,
    problemSolvingScore,
    usedFallback: false,
  };
}

function interviewEvalFallback(fromError: boolean): NormalizedInterviewEvaluation {
  return {
    overallScore: fromError ? 50 : 0,
    justification: fromError
      ? "The evaluation service returned data that could not be parsed. A neutral score was applied."
      : "",
    strengths: fromError ? ["Participation recorded; detailed strengths unavailable for this run."] : [],
    improvements: fromError
      ? ["Retry the interview summary or contact support if scores look wrong."]
      : [],
    technicalScore: null,
    communicationScore: null,
    problemSolvingScore: null,
    usedFallback: fromError,
  };
}

// --- Live mock interview assistant turn (trailing JSON only; ignore plain-text markers) ---

const mockInterviewEndSchema = z.object({
  type: z.literal("interview_end"),
  reason: z.string(),
  scores: z.object({
    technical: z.union([z.number(), z.string()]),
    communication: z.union([z.number(), z.string()]),
    problem_solving: z.union([z.number(), z.string()]),
    confidence: z.union([z.number(), z.string()]),
    consistency: z.union([z.number(), z.string()]),
  }),
});

const mockQuestionControlSchema = z.object({
  type: z.literal("question_control"),
  question_id: z.string().min(1),
  attempt: z.number(),
  is_followup: z.boolean(),
});

export type NormalizedMockInterviewEnd = {
  reason: string;
  scores: {
    technical: number;
    communication: number;
    problem_solving: number;
    confidence: number;
    consistency: number;
  };
};

export type NormalizedMockQuestionControl = {
  questionId: string;
  attempt: number;
  isFollowup: boolean;
};

export type ParsedMockInterviewAssistantTurn = {
  visibleText: string;
  interviewEnd: NormalizedMockInterviewEnd | null;
  questionControl: NormalizedMockQuestionControl | null;
};

function normalizeInterviewEndScores(
  scores: z.infer<typeof mockInterviewEndSchema>["scores"]
): NormalizedMockInterviewEnd["scores"] {
  return {
    technical: coerceScore(scores.technical) ?? 50,
    communication: coerceScore(scores.communication) ?? 50,
    problem_solving: coerceScore(scores.problem_solving) ?? 50,
    confidence: coerceScore(scores.confidence) ?? 50,
    consistency: coerceScore(scores.consistency) ?? 50,
  };
}

/**
 * Parses Nova's reply: spoken text first, then a single trailing JSON object.
 * End-of-interview is recognized only when that JSON has type "interview_end".
 */
export function parseMockInterviewAssistantTurn(raw: string): ParsedMockInterviewAssistantTurn {
  const trailing = extractTrailingJsonObject(raw);
  if (!trailing) {
    return { visibleText: raw.trim(), interviewEnd: null, questionControl: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trailing);
  } catch {
    const visibleText = stripTrailingJsonSlice(raw, trailing).trim();
    return { visibleText: visibleText || raw.trim(), interviewEnd: null, questionControl: null };
  }

  if (!parsed || typeof parsed !== "object") {
    const visibleText = stripTrailingJsonSlice(raw, trailing).trim();
    return { visibleText: visibleText || raw.trim(), interviewEnd: null, questionControl: null };
  }

  const t = (parsed as { type?: unknown }).type;
  if (t === "interview_end") {
    const end = mockInterviewEndSchema.safeParse(parsed);
    if (!end.success) {
      const visibleText = stripTrailingJsonSlice(raw, trailing).trim();
      return { visibleText: visibleText || raw.trim(), interviewEnd: null, questionControl: null };
    }
    const visibleText = stripTrailingJsonSlice(raw, trailing);
    return {
      visibleText,
      interviewEnd: {
        reason: end.data.reason.trim(),
        scores: normalizeInterviewEndScores(end.data.scores),
      },
      questionControl: null,
    };
  }

  if (t === "question_control") {
    const qc = mockQuestionControlSchema.safeParse(parsed);
    if (!qc.success) {
      const visibleText = stripTrailingJsonSlice(raw, trailing).trim();
      return { visibleText: visibleText || raw.trim(), interviewEnd: null, questionControl: null };
    }
    const visibleText = stripTrailingJsonSlice(raw, trailing);
    const attempt = Number.isFinite(qc.data.attempt) ? Math.round(qc.data.attempt) : 1;
    return {
      visibleText,
      interviewEnd: null,
      questionControl: {
        questionId: qc.data.question_id.trim(),
        attempt: Math.min(2, Math.max(1, attempt)),
        isFollowup: qc.data.is_followup,
      },
    };
  }

  const visibleText = stripTrailingJsonSlice(raw, trailing).trim();
  return { visibleText: visibleText || raw.trim(), interviewEnd: null, questionControl: null };
}

/** Neutral scores when the interview is terminated by failsafe rules. */
export function defaultMockInterviewEndScores(): NormalizedMockInterviewEnd["scores"] {
  return {
    technical: 50,
    communication: 50,
    problem_solving: 50,
    confidence: 50,
    consistency: 50,
  };
}
