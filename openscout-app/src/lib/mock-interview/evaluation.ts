import type { InterviewTranscriptQuality } from "@/lib/mock-interview/transcript-quality";

export const INTERVIEW_COMPETENCY_KEYS = [
  "technical_knowledge",
  "problem_solving",
  "communication",
  "system_design",
  "tradeoff_awareness",
] as const;

export const INTERVIEW_QUESTION_LABELS = ["no_response", "weak", "medium", "strong"] as const;
export const INTERVIEW_HIRE_RECOMMENDATIONS = ["strong_yes", "yes", "no", "strong_no"] as const;

export type InterviewCompetencyKey = (typeof INTERVIEW_COMPETENCY_KEYS)[number];
export type InterviewQuestionLabel = (typeof INTERVIEW_QUESTION_LABELS)[number];
export type InterviewEvaluationConfidence = "low" | "medium" | "high";
export type InterviewHireRecommendation = (typeof INTERVIEW_HIRE_RECOMMENDATIONS)[number];

export type InterviewQuestionCompetencies = Record<InterviewCompetencyKey, number>;

export type InterviewQuestionEvaluation = {
  question_id: string;
  answered: boolean;
  label: InterviewQuestionLabel;
  score: number;
  competencies: InterviewQuestionCompetencies;
  reason: string;
};

export type InterviewEvaluationCategory = {
  score: number;
  reason: string;
};

export type InterviewAnswerBreakdown = {
  question_id: string;
  result: InterviewQuestionLabel;
  reason: string;
};

export type InterviewEvaluationCoverage = {
  totalQuestions: number;
  answeredQuestions: number;
  unansweredQuestions: number;
  usableAnswerCount: number;
  competenciesCoveredCount: number;
};

export type DeterministicInterviewEvaluation = {
  finalScore: number;
  overallScore: number;
  confidence: InterviewEvaluationConfidence;
  confidenceScore: number;
  coverageScore: number;
  isPreliminary: boolean;
  competencyBreakdown: Record<InterviewCompetencyKey, number>;
  categories: Record<InterviewCompetencyKey, InterviewEvaluationCategory>;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  summary: string;
  justification: string;
  technicalScore: number | null;
  communicationScore: number | null;
  problemSolvingScore: number | null;
  questionEvaluations: InterviewQuestionEvaluation[];
  answerBreakdown: InterviewAnswerBreakdown[];
  hireRecommendation: InterviewHireRecommendation | null;
  coverage: InterviewEvaluationCoverage;
};

type LegacyInterviewEvaluationArgs = {
  overallScore: number;
  technicalScore: number | null;
  communicationScore: number | null;
  problemSolvingScore: number | null;
  justification: string;
  strengths: string[];
  weaknesses: string[];
};

type ComputeInterviewEvaluationArgs = {
  questionEvaluations: InterviewQuestionEvaluation[];
  transcriptQuality?: InterviewTranscriptQuality;
};

const INTERVIEW_COMPETENCY_WEIGHTS: Record<InterviewCompetencyKey, number> = {
  technical_knowledge: 0.3,
  problem_solving: 0.25,
  system_design: 0.15,
  tradeoff_awareness: 0.15,
  communication: 0.15,
};

const COMPETENCY_LABELS: Record<InterviewCompetencyKey, string> = {
  technical_knowledge: "technical knowledge",
  problem_solving: "problem solving",
  communication: "communication",
  system_design: "system design",
  tradeoff_awareness: "trade-off awareness",
};

function clampZeroToHundred(value: number): number {
  return Math.round(Math.min(100, Math.max(0, Number(value))));
}

function clampZeroToTen(value: number): number {
  return Math.round(Math.min(10, Math.max(0, Number(value))));
}

function emptyCompetencies(): InterviewQuestionCompetencies {
  return {
    technical_knowledge: 0,
    problem_solving: 0,
    communication: 0,
    system_design: 0,
    tradeoff_awareness: 0,
  };
}

function totalCompetencyPoints(competencies: InterviewQuestionCompetencies): number {
  return INTERVIEW_COMPETENCY_KEYS.reduce((sum, key) => sum + competencies[key], 0);
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const [sentence] = trimmed.split(/(?<=[.!?])\s+/);
  return (sentence ?? trimmed).trim();
}

function normalizeReason(text: string): string {
  const sentence = firstSentence(text);
  if (!sentence) return "";
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

function dedupeStrings(values: string[], limit: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeReason(value);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
    if (out.length >= limit) break;
  }
  return out;
}

function isUsableQuestionEvaluation(
  question: InterviewQuestionEvaluation,
  transcriptQuality?: InterviewTranscriptQuality
): boolean {
  if (!question.answered || question.label === "no_response" || question.score <= 0) return false;

  const minimumQuestionScore = transcriptQuality?.isLowSignal ? 6 : 4;
  const minimumCompetencyTotal = transcriptQuality?.isLowSignal ? 14 : 10;

  return (
    question.score >= minimumQuestionScore &&
    totalCompetencyPoints(question.competencies) >= minimumCompetencyTotal &&
    INTERVIEW_COMPETENCY_KEYS.some((key) => question.competencies[key] >= 3)
  );
}

function countUsableAnswers(
  questionEvaluations: InterviewQuestionEvaluation[],
  transcriptQuality?: InterviewTranscriptQuality
): number {
  return questionEvaluations.filter((question) => isUsableQuestionEvaluation(question, transcriptQuality)).length;
}

function countCoveredCompetencies(
  questionEvaluations: InterviewQuestionEvaluation[],
  transcriptQuality?: InterviewTranscriptQuality
): number {
  const usable = questionEvaluations.filter((question) => isUsableQuestionEvaluation(question, transcriptQuality));
  let count = 0;
  for (const key of INTERVIEW_COMPETENCY_KEYS) {
    const covered = usable.some((question) => question.competencies[key] >= 4);
    if (covered) count += 1;
  }
  return count;
}

function computeCompetencyBreakdown(
  questionEvaluations: InterviewQuestionEvaluation[]
): Record<InterviewCompetencyKey, number> {
  const denominator = Math.max(questionEvaluations.length, 1);

  return Object.fromEntries(
    INTERVIEW_COMPETENCY_KEYS.map((key) => {
      const total = questionEvaluations.reduce((sum, question) => sum + question.competencies[key], 0);
      return [key, clampZeroToHundred((total / denominator) * 10)];
    })
  ) as Record<InterviewCompetencyKey, number>;
}

function buildCompetencyReason(
  key: InterviewCompetencyKey,
  competencyBreakdown: Record<InterviewCompetencyKey, number>,
  questionEvaluations: InterviewQuestionEvaluation[]
): string {
  const scoredQuestions = questionEvaluations
    .filter((question) => question.answered)
    .sort((left, right) => right.competencies[key] - left.competencies[key]);

  if (scoredQuestions.length === 0) {
    return "No answered questions provided usable evidence in this area.";
  }

  const strongest = scoredQuestions[0];
  const clearSignalCount = scoredQuestions.filter((question) => question.competencies[key] >= 4).length;
  const baseReason =
    strongest.reason.trim() || `Evidence for ${COMPETENCY_LABELS[key]} was limited in the transcript.`;

  if (clearSignalCount <= 1) {
    return `${normalizeReason(baseReason)} Coverage in this competency was limited.`;
  }

  if (competencyBreakdown[key] >= 75) {
    return `${normalizeReason(baseReason)} This signal stayed consistent across multiple questions.`;
  }

  if (competencyBreakdown[key] >= 55) {
    return `${normalizeReason(baseReason)} The signal was present but not consistently deep across the interview.`;
  }

  return `${normalizeReason(baseReason)} The evidence in this competency stayed uneven across the interview.`;
}

function computeCoverageScore(args: {
  coverage: InterviewEvaluationCoverage;
  transcriptQuality?: InterviewTranscriptQuality;
}): number {
  const { coverage, transcriptQuality } = args;
  const answeredRatio =
    coverage.totalQuestions > 0 ? coverage.answeredQuestions / coverage.totalQuestions : 0;
  const diversityRatio = coverage.competenciesCoveredCount / INTERVIEW_COMPETENCY_KEYS.length;
  const questionCountRatio = Math.min(coverage.totalQuestions, 5) / 5;

  let score = Math.round((answeredRatio * 0.45 + diversityRatio * 0.2 + questionCountRatio * 0.35) * 100);

  if (transcriptQuality?.isLowSignal) score -= 12;
  if ((transcriptQuality?.averageUserTurnChars ?? 0) > 0 && (transcriptQuality?.averageUserTurnChars ?? 0) < 18) {
    score -= 8;
  }
  if ((transcriptQuality?.unansweredTurnCount ?? 0) > 0) {
    score -= Math.min(10, transcriptQuality!.unansweredTurnCount * 3);
  }

  return clampZeroToHundred(score);
}

function computeRawFinalScore(
  competencyBreakdown: Record<InterviewCompetencyKey, number>
): number {
  let total = 0;
  for (const key of INTERVIEW_COMPETENCY_KEYS) {
    total += competencyBreakdown[key] * INTERVIEW_COMPETENCY_WEIGHTS[key];
  }
  return clampZeroToHundred(total);
}

function scaleCompetencyBreakdown(args: {
  competencyBreakdown: Record<InterviewCompetencyKey, number>;
  rawFinalScore: number;
  finalScore: number;
}): Record<InterviewCompetencyKey, number> {
  const { competencyBreakdown, rawFinalScore, finalScore } = args;
  if (rawFinalScore <= 0 || finalScore >= rawFinalScore) {
    return competencyBreakdown;
  }

  const scale = finalScore / rawFinalScore;
  return Object.fromEntries(
    INTERVIEW_COMPETENCY_KEYS.map((key) => [
      key,
      Math.max(0, Math.min(100, Math.floor(competencyBreakdown[key] * scale))),
    ])
  ) as Record<InterviewCompetencyKey, number>;
}

function applyEvidenceGate(args: {
  rawFinalScore: number;
  coverageScore: number;
  transcriptQuality?: InterviewTranscriptQuality;
  coverage: InterviewEvaluationCoverage;
}): { finalScore: number; isPreliminary: boolean } {
  const { rawFinalScore, coverageScore, transcriptQuality, coverage } = args;
  if (coverage.totalQuestions === 0 || coverage.answeredQuestions === 0) {
    return { finalScore: 0, isPreliminary: true };
  }

  let finalScore = rawFinalScore;
  let isPreliminary = false;

  if (coverage.usableAnswerCount === 0) {
    finalScore = Math.min(finalScore, 10);
    isPreliminary = true;
  } else if (coverage.usableAnswerCount === 1) {
    finalScore = Math.min(finalScore, 20);
    isPreliminary = true;
  } else if (coverage.usableAnswerCount === 2) {
    finalScore = Math.min(finalScore, 35);
    isPreliminary = true;
  }

  if (coverage.totalQuestions < 3 || coverage.answeredQuestions < 3 || coverageScore < 60) {
    isPreliminary = true;
  }

  if (transcriptQuality?.scoreCap != null) {
    finalScore = Math.min(finalScore, transcriptQuality.scoreCap);
  }

  if (transcriptQuality?.isLowSignal) {
    isPreliminary = true;
  }

  return {
    finalScore: clampZeroToHundred(finalScore),
    isPreliminary,
  };
}

function computeConfidence(args: {
  coverageScore: number;
  coverage: InterviewEvaluationCoverage;
  transcriptQuality?: InterviewTranscriptQuality;
}): InterviewEvaluationConfidence {
  const { coverageScore, coverage, transcriptQuality } = args;

  if (
    coverage.totalQuestions < 3 ||
    coverage.answeredQuestions < 3 ||
    coverage.usableAnswerCount < 3 ||
    coverage.competenciesCoveredCount < 3 ||
    coverageScore < 60 ||
    Boolean(transcriptQuality?.isLowSignal)
  ) {
    return "low";
  }

  if (
    coverageScore < 85 ||
    coverage.usableAnswerCount < 4 ||
    coverage.competenciesCoveredCount < INTERVIEW_COMPETENCY_KEYS.length ||
    coverage.answeredQuestions < coverage.totalQuestions
  ) {
    return "medium";
  }

  return "high";
}

function confidenceToScore(confidence: InterviewEvaluationConfidence): number {
  if (confidence === "high") return 85;
  if (confidence === "medium") return 65;
  return 35;
}

function buildStrengths(args: {
  questionEvaluations: InterviewQuestionEvaluation[];
  competencyBreakdown: Record<InterviewCompetencyKey, number>;
}): string[] {
  const strongReasons = args.questionEvaluations
    .filter((question) => question.answered && (question.label === "strong" || question.score >= 7))
    .sort((left, right) => right.score - left.score)
    .map((question) => question.reason);

  const competencyNotes = [...INTERVIEW_COMPETENCY_KEYS]
    .sort((left, right) => args.competencyBreakdown[right] - args.competencyBreakdown[left])
    .filter((key) => args.competencyBreakdown[key] >= 65)
    .map(
      (key) =>
        `Best evidence was in ${COMPETENCY_LABELS[key]} (${args.competencyBreakdown[key]}/100).`
    );

  return dedupeStrings([...strongReasons, ...competencyNotes], 4);
}

function buildWeaknesses(args: {
  questionEvaluations: InterviewQuestionEvaluation[];
  competencyBreakdown: Record<InterviewCompetencyKey, number>;
  coverage: InterviewEvaluationCoverage;
}): string[] {
  const missedQuestionReasons = args.questionEvaluations
    .filter((question) => !question.answered || question.label === "no_response")
    .map((question) => question.reason || "A question was left unanswered.");
  const weakReasons = args.questionEvaluations
    .filter((question) => question.answered && question.label === "weak")
    .sort((left, right) => left.score - right.score)
    .map((question) => question.reason);
  const competencyNotes = [...INTERVIEW_COMPETENCY_KEYS]
    .sort((left, right) => args.competencyBreakdown[left] - args.competencyBreakdown[right])
    .filter((key) => args.competencyBreakdown[key] <= 55)
    .map(
      (key) =>
        `Evidence for ${COMPETENCY_LABELS[key]} stayed limited (${args.competencyBreakdown[key]}/100).`
    );

  const unansweredNote =
    args.coverage.unansweredQuestions > 0
      ? [`${args.coverage.unansweredQuestions} question(s) were effectively unanswered.`]
      : [];
  const lowEvidenceNote =
    args.coverage.usableAnswerCount <= 1
      ? [`Only ${args.coverage.usableAnswerCount} answer(s) contained usable interview evidence.`]
      : [];

  return dedupeStrings(
    [...missedQuestionReasons, ...weakReasons, ...competencyNotes, ...unansweredNote, ...lowEvidenceNote],
    4
  );
}

function buildSummary(args: {
  finalScore: number;
  confidence: InterviewEvaluationConfidence;
  coverageScore: number;
  isPreliminary: boolean;
  competencyBreakdown: Record<InterviewCompetencyKey, number>;
  coverage: InterviewEvaluationCoverage;
}): string {
  if (args.coverage.answeredQuestions === 0) {
    return "Preliminary assessment: no answered questions provided usable interview evidence. Final score is 0/100 with low confidence.";
  }

  if (args.coverage.usableAnswerCount === 0) {
    return `Preliminary assessment: answers were recorded, but none contained enough usable evidence for a normal score. Final score stayed at ${args.finalScore}/100 with ${args.confidence} confidence.`;
  }

  const ordered = [...INTERVIEW_COMPETENCY_KEYS].sort(
    (left, right) => args.competencyBreakdown[right] - args.competencyBreakdown[left]
  );
  const strongest = COMPETENCY_LABELS[ordered[0]];
  const weakest = COMPETENCY_LABELS[ordered[ordered.length - 1]];
  const scoreSignal =
    args.finalScore >= 80
      ? "strong"
      : args.finalScore >= 65
        ? "solid"
        : args.finalScore >= 50
          ? "mixed"
          : "limited";
  const preliminaryPrefix = args.isPreliminary ? "Preliminary assessment: " : "";
  const unansweredClause =
    args.coverage.unansweredQuestions > 0
      ? ` ${args.coverage.unansweredQuestions} question(s) were unanswered or carried no usable evidence.`
      : "";
  const usableEvidenceClause =
    args.coverage.usableAnswerCount <= 2
      ? ` Only ${args.coverage.usableAnswerCount} answer(s) contained usable evidence, so the score was capped conservatively.`
      : "";

  return `${preliminaryPrefix}${scoreSignal} interview signal at ${args.finalScore}/100, with ${args.confidence} confidence and ${args.coverageScore}/100 coverage. Strongest evidence appeared in ${strongest}; the weakest area was ${weakest}.${unansweredClause}${usableEvidenceClause}`.trim();
}

function computeHireRecommendation(args: {
  finalScore: number;
  confidence: InterviewEvaluationConfidence;
  coverage: InterviewEvaluationCoverage;
  coverageScore: number;
}): InterviewHireRecommendation {
  if (args.coverage.answeredQuestions === 0 || args.coverage.usableAnswerCount < 2) {
    return "strong_no";
  }
  if (
    args.finalScore >= 82 &&
    args.confidence === "high" &&
    args.coverage.unansweredQuestions === 0 &&
    args.coverage.usableAnswerCount >= 4
  ) {
    return "strong_yes";
  }
  if (args.finalScore >= 68 && args.confidence !== "low" && args.coverage.usableAnswerCount >= 3) {
    return "yes";
  }
  if (
    args.finalScore < 45 ||
    args.coverage.unansweredQuestions >= 2 ||
    args.coverageScore < 45
  ) {
    return "strong_no";
  }
  return "no";
}

export function createLegacyInterviewEvaluation(
  args: LegacyInterviewEvaluationArgs
): DeterministicInterviewEvaluation {
  const cappedLegacyScore = clampZeroToHundred(Math.min(args.overallScore, 10));
  const technical = Math.min(args.technicalScore ?? cappedLegacyScore, cappedLegacyScore);
  const communication = Math.min(args.communicationScore ?? cappedLegacyScore, cappedLegacyScore);
  const problemSolving = Math.min(args.problemSolvingScore ?? cappedLegacyScore, cappedLegacyScore);
  const competencyBreakdown = {
    technical_knowledge: clampZeroToHundred(technical),
    problem_solving: clampZeroToHundred(problemSolving),
    communication: clampZeroToHundred(communication),
    system_design: clampZeroToHundred((technical + problemSolving) / 2),
    tradeoff_awareness: clampZeroToHundred(problemSolving),
  } satisfies Record<InterviewCompetencyKey, number>;
  const categories = Object.fromEntries(
    INTERVIEW_COMPETENCY_KEYS.map((key) => [
      key,
      {
        score: clampZeroToTen(competencyBreakdown[key] / 10),
        reason: "",
      },
    ])
  ) as Record<InterviewCompetencyKey, InterviewEvaluationCategory>;
  const strengths = dedupeStrings(args.strengths, 4);
  const weaknesses = dedupeStrings(args.weaknesses, 4);
  const summary = args.justification.trim() || "Legacy interview evaluation imported without question-level evidence.";

  return {
    finalScore: cappedLegacyScore,
    overallScore: cappedLegacyScore,
    confidence: "low",
    confidenceScore: confidenceToScore("low"),
    coverageScore: 0,
    isPreliminary: true,
    competencyBreakdown,
    categories,
    strengths,
    weaknesses,
    improvements: weaknesses,
    summary,
    justification: summary,
    technicalScore: competencyBreakdown.technical_knowledge,
    communicationScore: competencyBreakdown.communication,
    problemSolvingScore: competencyBreakdown.problem_solving,
    questionEvaluations: [],
    answerBreakdown: [],
    hireRecommendation: "strong_no",
    coverage: {
      totalQuestions: 0,
      answeredQuestions: 0,
      unansweredQuestions: 0,
      usableAnswerCount: 0,
      competenciesCoveredCount: 0,
    },
  };
}

export function createFallbackInterviewEvaluation(
  fromError: boolean,
  transcriptQuality?: InterviewTranscriptQuality
): DeterministicInterviewEvaluation {
  const fallbackScore =
    transcriptQuality?.signalStrength === "strong"
      ? 10
      : transcriptQuality?.signalStrength === "moderate"
        ? 5
        : 0;
  const summary = fromError
    ? "Automated interview scoring could not read usable question-level evidence. A conservative low-evidence result was applied."
    : "";
  const categories = Object.fromEntries(
    INTERVIEW_COMPETENCY_KEYS.map((key) => [
      key,
      {
        score: clampZeroToTen(fallbackScore / 10),
        reason: fromError ? "Structured question-level evidence was unavailable, so this area stayed near zero." : "",
      },
    ])
  ) as Record<InterviewCompetencyKey, InterviewEvaluationCategory>;

  return {
    finalScore: fromError ? fallbackScore : 0,
    overallScore: fromError ? fallbackScore : 0,
    confidence: "low",
    confidenceScore: confidenceToScore("low"),
    coverageScore: 0,
    isPreliminary: true,
    competencyBreakdown: Object.fromEntries(
      INTERVIEW_COMPETENCY_KEYS.map((key) => [key, fromError ? fallbackScore : 0])
    ) as Record<InterviewCompetencyKey, number>,
    categories,
    strengths: [],
    weaknesses: fromError ? ["Question-level scoring was unavailable, so the interview was treated as low evidence."] : [],
    improvements: fromError ? ["Retake or re-run the interview evaluation to capture usable question-level evidence."] : [],
    summary,
    justification: summary,
    technicalScore: fromError ? fallbackScore : 0,
    communicationScore: fromError ? fallbackScore : 0,
    problemSolvingScore: fromError ? fallbackScore : 0,
    questionEvaluations: [],
    answerBreakdown: [],
    hireRecommendation: "strong_no",
    coverage: {
      totalQuestions: 0,
      answeredQuestions: 0,
      unansweredQuestions: 0,
      usableAnswerCount: 0,
      competenciesCoveredCount: 0,
    },
  };
}

export function computeInterviewEvaluation(
  args: ComputeInterviewEvaluationArgs
): DeterministicInterviewEvaluation {
  const usableAnswerCount = countUsableAnswers(args.questionEvaluations, args.transcriptQuality);
  const coverage: InterviewEvaluationCoverage = {
    totalQuestions: args.questionEvaluations.length,
    answeredQuestions: args.questionEvaluations.filter((question) => question.answered).length,
    unansweredQuestions: args.questionEvaluations.filter((question) => !question.answered).length,
    usableAnswerCount,
    competenciesCoveredCount: countCoveredCompetencies(args.questionEvaluations, args.transcriptQuality),
  };
  const rawCompetencyBreakdown = computeCompetencyBreakdown(args.questionEvaluations);
  const rawFinalScore = computeRawFinalScore(rawCompetencyBreakdown);
  const coverageScore = computeCoverageScore({
    coverage,
    transcriptQuality: args.transcriptQuality,
  });
  const { finalScore, isPreliminary } = applyEvidenceGate({
    rawFinalScore,
    coverageScore,
    transcriptQuality: args.transcriptQuality,
    coverage,
  });
  const competencyBreakdown = scaleCompetencyBreakdown({
    competencyBreakdown: rawCompetencyBreakdown,
    rawFinalScore,
    finalScore,
  });
  const normalizedFinalScore = computeRawFinalScore(competencyBreakdown);
  const confidence = computeConfidence({
    coverageScore,
    coverage,
    transcriptQuality: args.transcriptQuality,
  });
  const categories = Object.fromEntries(
    INTERVIEW_COMPETENCY_KEYS.map((key) => [
      key,
      {
        score: clampZeroToTen(competencyBreakdown[key] / 10),
        reason: buildCompetencyReason(key, competencyBreakdown, args.questionEvaluations),
      },
    ])
  ) as Record<InterviewCompetencyKey, InterviewEvaluationCategory>;
  const strengths = buildStrengths({
    questionEvaluations: args.questionEvaluations,
    competencyBreakdown,
  });
  const weaknesses = buildWeaknesses({
    questionEvaluations: args.questionEvaluations,
    competencyBreakdown,
    coverage,
  });
  const summary = buildSummary({
    finalScore: normalizedFinalScore,
    confidence,
    coverageScore,
    isPreliminary,
    competencyBreakdown,
    coverage,
  });
  const answerBreakdown = args.questionEvaluations.map((question) => ({
    question_id: question.question_id,
    result: question.label,
    reason: question.reason,
  }));
  const hireRecommendation = computeHireRecommendation({
    finalScore: normalizedFinalScore,
    confidence,
    coverage,
    coverageScore,
  });

  return {
    finalScore: normalizedFinalScore,
    overallScore: normalizedFinalScore,
    confidence,
    confidenceScore: confidenceToScore(confidence),
    coverageScore,
    isPreliminary,
    competencyBreakdown,
    categories,
    strengths,
    weaknesses,
    improvements: weaknesses,
    summary,
    justification: summary,
    technicalScore: competencyBreakdown.technical_knowledge,
    communicationScore: competencyBreakdown.communication,
    problemSolvingScore: competencyBreakdown.problem_solving,
    questionEvaluations: args.questionEvaluations,
    answerBreakdown,
    hireRecommendation,
    coverage,
  };
}

export function defaultInterviewQuestionEvaluation(questionId: string): InterviewQuestionEvaluation {
  return {
    question_id: questionId,
    answered: false,
    label: "no_response",
    score: 0,
    competencies: emptyCompetencies(),
    reason: "",
  };
}
