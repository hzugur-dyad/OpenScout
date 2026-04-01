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

const INTERVIEW_CATEGORY_KEYS = [
  "technical_knowledge",
  "problem_solving",
  "system_design",
  "communication",
  "tradeoffs",
  "practical_experience",
] as const;

const INTERVIEW_ANSWER_RESULTS = ["strong", "medium", "weak", "no_response"] as const;
const INTERVIEW_HIRE_RECOMMENDATIONS = ["strong_yes", "yes", "no", "strong_no"] as const;

export type InterviewEvaluationCategoryKey = (typeof INTERVIEW_CATEGORY_KEYS)[number];
export type InterviewEvaluationAnswerResult = (typeof INTERVIEW_ANSWER_RESULTS)[number];
export type InterviewHireRecommendation = (typeof INTERVIEW_HIRE_RECOMMENDATIONS)[number];

export type InterviewEvaluationCategory = {
  score: number;
  reason: string;
};

export type InterviewEvaluationAnswerBreakdown = {
  question_id: string;
  result: InterviewEvaluationAnswerResult;
  reason: string;
};

const INTERVIEW_CATEGORY_WEIGHTS: Record<InterviewEvaluationCategoryKey, number> = {
  technical_knowledge: 0.25,
  problem_solving: 0.25,
  system_design: 0.2,
  communication: 0.15,
  tradeoffs: 0.1,
  practical_experience: 0.05,
};

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

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const [sentence] = trimmed.split(/(?<=[.!?])\s+/);
  return sentence?.trim() || trimmed;
}

function defaultInterviewCategories(reason = ""): Record<InterviewEvaluationCategoryKey, InterviewEvaluationCategory> {
  return Object.fromEntries(
    INTERVIEW_CATEGORY_KEYS.map((key) => [key, { score: 5, reason }])
  ) as Record<InterviewEvaluationCategoryKey, InterviewEvaluationCategory>;
}

function computeInterviewFinalScore(
  categories: Record<InterviewEvaluationCategoryKey, InterviewEvaluationCategory>
): number {
  let sum = 0;
  for (const key of INTERVIEW_CATEGORY_KEYS) {
    sum += categories[key].score * INTERVIEW_CATEGORY_WEIGHTS[key];
  }
  return clampScore(sum * 10);
}

const interviewCategoryLooseSchema = z
  .object({
    score: z.union([z.number(), z.string()]).optional(),
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

/** Interview evaluation: supports the recruiter-grade JSON shape and legacy fields. */
const interviewEvalLooseSchema = z
  .object({
    final_score: z.union([z.number(), z.string()]).optional(),
    categories: z.record(z.string(), interviewCategoryLooseSchema).optional(),
    answer_breakdown: z.array(interviewAnswerBreakdownLooseSchema).optional(),
    strengths: z.array(z.union([z.string(), z.number()])).optional(),
    weaknesses: z.array(z.union([z.string(), z.number()])).optional(),
    hire_recommendation: z.string().optional(),
    score: z.union([z.number(), z.string()]).optional(),
    overall_score: z.union([z.number(), z.string()]).optional(),
    justification: z.string().optional(),
    improvements: z.array(z.union([z.string(), z.number()])).optional(),
    technical_score: z.union([z.number(), z.string()]).optional(),
    communication_score: z.union([z.number(), z.string()]).optional(),
    problem_solving_score: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();

function normalizeInterviewCategories(
  rawCategories: Record<string, z.infer<typeof interviewCategoryLooseSchema>> | undefined
): {
  categories: Record<InterviewEvaluationCategoryKey, InterviewEvaluationCategory>;
  hasStructuredCategories: boolean;
} {
  const categories = defaultInterviewCategories();
  let hasStructuredCategories = false;

  for (const key of INTERVIEW_CATEGORY_KEYS) {
    const raw = rawCategories?.[key];
    if (!raw) continue;
    const score = coerceTenPointScore(raw.score);
    const reason = typeof raw.reason === "string" ? raw.reason.trim() : "";
    if (score !== undefined || reason) hasStructuredCategories = true;
    categories[key] = { score: score ?? 5, reason };
  }

  return { categories, hasStructuredCategories };
}

function buildLegacyInterviewCategories(args: {
  overallScore: number;
  technicalScore: number | null;
  communicationScore: number | null;
  problemSolvingScore: number | null;
}): Record<InterviewEvaluationCategoryKey, InterviewEvaluationCategory> {
  const baseline = clampTenPointScore(args.overallScore / 10);
  const technical = args.technicalScore !== null ? clampTenPointScore(args.technicalScore / 10) : baseline;
  const communication =
    args.communicationScore !== null ? clampTenPointScore(args.communicationScore / 10) : baseline;
  const problemSolving =
    args.problemSolvingScore !== null ? clampTenPointScore(args.problemSolvingScore / 10) : baseline;
  const systemDesign = clampTenPointScore((technical + problemSolving) / 2);
  const tradeoffs = problemSolving;

  return {
    technical_knowledge: { score: technical, reason: "" },
    problem_solving: { score: problemSolving, reason: "" },
    system_design: { score: systemDesign, reason: "" },
    communication: { score: communication, reason: "" },
    tradeoffs: { score: tradeoffs, reason: "" },
    practical_experience: { score: baseline, reason: "" },
  };
}

function coerceInterviewAnswerResult(value: unknown): InterviewEvaluationAnswerResult | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return INTERVIEW_ANSWER_RESULTS.find((item) => item === normalized);
}

function coerceInterviewHireRecommendation(value: unknown): InterviewHireRecommendation | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return INTERVIEW_HIRE_RECOMMENDATIONS.find((item) => item === normalized) ?? null;
}

function deriveInterviewHighlights(
  categories: Record<InterviewEvaluationCategoryKey, InterviewEvaluationCategory>,
  direction: "high" | "low"
): string[] {
  const ordered = [...INTERVIEW_CATEGORY_KEYS]
    .map((key) => ({ key, ...categories[key] }))
    .sort((a, b) => (direction === "high" ? b.score - a.score : a.score - b.score));
  const filtered = ordered.filter((entry) => (direction === "high" ? entry.score >= 6 : entry.score <= 6));
  const source = filtered.length > 0 ? filtered : ordered;

  return source
    .map((entry) => firstSentence(entry.reason))
    .filter(Boolean)
    .slice(0, 3);
}

function buildInterviewJustification(args: {
  explicitJustification: string;
  categories: Record<InterviewEvaluationCategoryKey, InterviewEvaluationCategory>;
  strengths: string[];
  improvements: string[];
}): string {
  if (args.explicitJustification) return args.explicitJustification;

  const ordered = [...INTERVIEW_CATEGORY_KEYS]
    .map((key) => ({ key, ...args.categories[key] }))
    .sort((a, b) => b.score - a.score);
  const strongest = ordered[0];
  const weakest = ordered[ordered.length - 1];
  const parts: string[] = [];

  if (strongest?.reason) parts.push(strongest.reason.trim());
  if (weakest?.reason && weakest.key !== strongest?.key) parts.push(weakest.reason.trim());
  if (parts.length === 0) {
    if (args.strengths[0]) parts.push(args.strengths[0]);
    if (args.improvements[0]) parts.push(args.improvements[0]);
  }

  return parts.join(" ").trim();
}

export type NormalizedInterviewEvaluation = {
  overallScore: number;
  justification: string;
  strengths: string[];
  improvements: string[];
  technicalScore: number | null;
  communicationScore: number | null;
  problemSolvingScore: number | null;
  categories: Record<InterviewEvaluationCategoryKey, InterviewEvaluationCategory>;
  answerBreakdown: InterviewEvaluationAnswerBreakdown[];
  hireRecommendation: InterviewHireRecommendation | null;
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
  const legacyOverallScore = coerceScore(d.final_score) ?? coerceScore(d.score) ?? coerceScore(d.overall_score) ?? 50;
  const legacyTechnicalScore = coerceScore(d.technical_score) ?? null;
  const legacyCommunicationScore = coerceScore(d.communication_score) ?? null;
  const legacyProblemSolvingScore = coerceScore(d.problem_solving_score) ?? null;

  const normalizedCategories = normalizeInterviewCategories(d.categories);
  const categories = normalizedCategories.hasStructuredCategories
    ? normalizedCategories.categories
    : buildLegacyInterviewCategories({
        overallScore: legacyOverallScore,
        technicalScore: legacyTechnicalScore,
        communicationScore: legacyCommunicationScore,
        problemSolvingScore: legacyProblemSolvingScore,
      });

  const strengthsFromOutput = normalizeStringArray(d.strengths, 8);
  const weaknessesFromOutput = normalizeStringArray(d.weaknesses, 8);
  const improvementsFromOutput = normalizeStringArray(d.improvements, 8);
  const strengths =
    strengthsFromOutput.length > 0
      ? strengthsFromOutput
      : normalizedCategories.hasStructuredCategories
        ? deriveInterviewHighlights(categories, "high")
        : [];
  const improvementsBase = weaknessesFromOutput.length > 0 ? weaknessesFromOutput : improvementsFromOutput;
  const improvements =
    improvementsBase.length > 0
      ? improvementsBase
      : normalizedCategories.hasStructuredCategories
        ? deriveInterviewHighlights(categories, "low")
        : [];

  const overallScore = normalizedCategories.hasStructuredCategories
    ? computeInterviewFinalScore(categories)
    : legacyOverallScore;

  const justification = buildInterviewJustification({
    explicitJustification: typeof d.justification === "string" ? d.justification.trim() : "",
    categories,
    strengths,
    improvements,
  });

  const answerBreakdown = Array.isArray(d.answer_breakdown)
    ? d.answer_breakdown
        .map((item, index) => {
          const questionId =
            typeof item.question_id === "string" && item.question_id.trim()
              ? item.question_id.trim()
              : typeof item.question_id === "number" && Number.isFinite(item.question_id)
                ? `q${Math.max(1, Math.round(item.question_id))}`
                : `q${index + 1}`;
          const result = coerceInterviewAnswerResult(item.result);
          if (!result) return null;
          return {
            question_id: questionId,
            result,
            reason: typeof item.reason === "string" ? item.reason.trim() : "",
          };
        })
        .filter((item): item is InterviewEvaluationAnswerBreakdown => item !== null)
        .slice(0, 40)
    : [];

  return {
    overallScore,
    justification,
    strengths,
    improvements,
    technicalScore:
      normalizedCategories.hasStructuredCategories
        ? categories.technical_knowledge.score * 10
        : legacyTechnicalScore,
    communicationScore:
      normalizedCategories.hasStructuredCategories
        ? categories.communication.score * 10
        : legacyCommunicationScore,
    problemSolvingScore:
      normalizedCategories.hasStructuredCategories
        ? categories.problem_solving.score * 10
        : legacyProblemSolvingScore,
    categories,
    answerBreakdown,
    hireRecommendation: coerceInterviewHireRecommendation(d.hire_recommendation),
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
    categories: defaultInterviewCategories(
      fromError ? "Automated evaluation could not be parsed; a neutral fallback was applied." : ""
    ),
    answerBreakdown: [],
    hireRecommendation: null,
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
