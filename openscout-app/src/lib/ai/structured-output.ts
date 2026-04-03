import { z } from "zod";
import { extractJsonObjectFromModelText, extractTrailingJsonObject, stripTrailingJsonSlice } from "@/lib/ai/extract-json";
import { logWarn } from "@/lib/logger";
import {
  computeInterviewEvaluation,
  createFallbackInterviewEvaluation,
  defaultInterviewQuestionEvaluation,
  INTERVIEW_COMPETENCY_KEYS,
  INTERVIEW_QUESTION_LABELS,
  type DeterministicInterviewEvaluation,
  type InterviewAnswerBreakdown,
  type InterviewCompetencyKey,
  type InterviewEvaluationCategory,
  type InterviewHireRecommendation,
  type InterviewQuestionEvaluation,
  type InterviewQuestionLabel,
} from "@/lib/mock-interview/evaluation";
import type { InterviewTranscriptQuality } from "@/lib/mock-interview/transcript-quality";

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

export type InterviewEvaluationCategoryKey = InterviewCompetencyKey;
export type InterviewEvaluationAnswerResult = InterviewQuestionLabel;

function clampTenPointScore(n: number): number {
  return Math.round(Math.min(10, Math.max(0, Number(n))));
}

function coerceTenPointScore(v: unknown): number | undefined {
  if (typeof v === "number" && !Number.isNaN(v)) return clampTenPointScore(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (!Number.isNaN(n)) return clampTenPointScore(n);
  }
  return undefined;
}

function normalizeStringArray(values: Array<string | number> | undefined, limit: number): string[] {
  return Array.isArray(values)
    ? values
        .map((value) => String(value).trim())
        .filter(Boolean)
        .slice(0, limit)
    : [];
}

const interviewQuestionEvaluationLooseSchema = z
  .object({
    question_id: z.union([z.string(), z.number()]).optional(),
    answered: z.union([z.boolean(), z.string(), z.number()]).optional(),
    label: z.string().optional(),
    score: z.union([z.number(), z.string()]).optional(),
    competencies: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
    reason: z.string().optional(),
  })
  .passthrough();

const interviewAnswerBreakdownLooseSchema = z
  .object({
    question_id: z.union([z.string(), z.number()]).optional(),
    result: z.string().optional(),
    reason: z.string().optional(),
  })
  .passthrough();

const interviewEvalLooseSchema = z
  .object({
    question_evaluations: z.array(interviewQuestionEvaluationLooseSchema).optional(),
    answer_breakdown: z.array(interviewAnswerBreakdownLooseSchema).optional(),
    final_score: z.union([z.number(), z.string()]).optional(),
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

function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

function coerceInterviewQuestionLabel(value: unknown): InterviewQuestionLabel | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return INTERVIEW_QUESTION_LABELS.find((label) => label === normalized);
}

function labelFromQuestionScore(score: number): InterviewQuestionLabel {
  if (score <= 0) return "no_response";
  if (score <= 3) return "weak";
  if (score <= 6) return "medium";
  return "strong";
}

function lowerConfidenceLabel(
  left: InterviewQuestionLabel,
  right: InterviewQuestionLabel
): InterviewQuestionLabel {
  const rank: Record<InterviewQuestionLabel, number> = {
    no_response: 0,
    weak: 1,
    medium: 2,
    strong: 3,
  };
  return rank[left] <= rank[right] ? left : right;
}

function normalizeInterviewQuestionEvaluation(
  rawQuestion: z.infer<typeof interviewQuestionEvaluationLooseSchema>,
  index: number
): InterviewQuestionEvaluation {
  const questionId =
    typeof rawQuestion.question_id === "string" && rawQuestion.question_id.trim()
      ? rawQuestion.question_id.trim()
      : typeof rawQuestion.question_id === "number" && Number.isFinite(rawQuestion.question_id)
        ? `q${Math.max(1, Math.round(rawQuestion.question_id))}`
        : `q${index + 1}`;
  const fallback = defaultInterviewQuestionEvaluation(questionId);
  const answered = coerceBoolean(rawQuestion.answered);
  const rawLabel = coerceInterviewQuestionLabel(rawQuestion.label);
  const providedScore = coerceTenPointScore(rawQuestion.score);
  const inferredAnswered =
    answered ?? (rawLabel ? rawLabel !== "no_response" : providedScore !== undefined ? providedScore > 0 : false);

  if (!inferredAnswered) {
    return {
      ...fallback,
      reason: typeof rawQuestion.reason === "string" ? rawQuestion.reason.trim() : "",
    };
  }

  const score =
    providedScore && providedScore > 0
      ? providedScore
      : rawLabel === "strong"
        ? 8
        : rawLabel === "medium"
          ? 6
          : rawLabel === "weak"
            ? 3
            : 0;
  const derivedLabel = labelFromQuestionScore(score);
  const label = rawLabel && rawLabel !== "no_response" ? lowerConfidenceLabel(rawLabel, derivedLabel) : derivedLabel;
  const competencies = { ...fallback.competencies };
  for (const key of INTERVIEW_COMPETENCY_KEYS) {
    competencies[key] = coerceTenPointScore(rawQuestion.competencies?.[key]) ?? 0;
  }

  return {
    question_id: questionId,
    answered: true,
    label,
    score,
    competencies,
    reason: typeof rawQuestion.reason === "string" ? rawQuestion.reason.trim() : "",
  };
}

function normalizeLegacyAnswerBreakdown(
  rawBreakdown: Array<z.infer<typeof interviewAnswerBreakdownLooseSchema>> | undefined
): InterviewAnswerBreakdown[] {
  return Array.isArray(rawBreakdown)
    ? rawBreakdown
        .map((item, index) => {
          const result = coerceInterviewQuestionLabel(item.result);
          if (!result) return null;
          const questionId =
            typeof item.question_id === "string" && item.question_id.trim()
              ? item.question_id.trim()
              : typeof item.question_id === "number" && Number.isFinite(item.question_id)
                ? `q${Math.max(1, Math.round(item.question_id))}`
                : `q${index + 1}`;
          return {
            question_id: questionId,
            result,
            reason: typeof item.reason === "string" ? item.reason.trim() : "",
          };
        })
        .filter((item): item is InterviewAnswerBreakdown => item !== null)
        .slice(0, 40)
    : [];
}

export type NormalizedInterviewEvaluation = DeterministicInterviewEvaluation & {
  usedFallback: boolean;
};

export function parseInterviewEvaluationModelOutput(
  rawModelText: string,
  options: { transcriptQuality?: InterviewTranscriptQuality } = {}
): NormalizedInterviewEvaluation {
  const jsonStr = extractJsonObjectFromModelText(rawModelText);
  let raw: unknown;
  try {
    raw = JSON.parse(jsonStr);
  } catch {
    logWarn("mock-interview result: invalid JSON, using fallback");
    return {
      ...createFallbackInterviewEvaluation(true, options.transcriptQuality),
      usedFallback: true,
    };
  }

  const parsed = interviewEvalLooseSchema.safeParse(raw);
  if (!parsed.success) {
    logWarn("mock-interview result: schema mismatch, using fallback");
    return {
      ...createFallbackInterviewEvaluation(true, options.transcriptQuality),
      usedFallback: true,
    };
  }

  const d = parsed.data;
  const questionEvaluations = Array.isArray(d.question_evaluations)
    ? d.question_evaluations.map((question, index) => normalizeInterviewQuestionEvaluation(question, index)).slice(0, 40)
    : [];

  if (questionEvaluations.length > 0) {
    return {
      ...computeInterviewEvaluation({
        questionEvaluations,
        transcriptQuality: options.transcriptQuality,
      }),
      usedFallback: false,
    };
  }

  const legacyAnswerBreakdown = normalizeLegacyAnswerBreakdown(d.answer_breakdown);
  const fallbackEvaluation = createFallbackInterviewEvaluation(true, options.transcriptQuality);

  return {
    ...fallbackEvaluation,
    answerBreakdown: legacyAnswerBreakdown,
    usedFallback: true,
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
