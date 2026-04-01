import type { InterviewLocale } from "@/lib/interview-locale";
import { computeDeterministicInterviewOverallScore } from "@/lib/mock-interview/policy";
import { logWarn } from "@/lib/logger";
import {
  buildInterviewScoringSystemPrompt,
  buildInterviewScoringUserPrompt,
  buildInterviewThinkingSystemPrompt,
  buildInterviewThinkingUserPrompt,
} from "@/lib/interview/promptBuilder";
import {
  parseInterviewScoreModelOutput,
  parseInterviewThinkingModelOutput,
} from "@/lib/interview/scoring";
import { createGroqJsonCompletion, getGroqScoringModel, getGroqThinkingModel } from "@/services/groq";
import {
  buildInterviewFallbackQuestion,
  buildRealtimeSpeechInstructions,
  createInterviewTurnPlan,
  getRemainingCustomQuestions,
  sanitizeInterviewText,
  type InterviewControlState,
  type InterviewJobContext,
  type InterviewQuestionHistoryEntry,
  type InterviewScorecard,
  type InterviewTranscriptEntry,
  type InterviewTurnPlan,
} from "@/services/interview";

function findCurrentQuestionHistoryEntry(args: {
  currentControl?: InterviewControlState;
  questionHistory: InterviewQuestionHistoryEntry[];
}): InterviewQuestionHistoryEntry | null {
  if (!args.currentControl) return null;

  for (let index = args.questionHistory.length - 1; index >= 0; index -= 1) {
    const entry = args.questionHistory[index];
    if (entry.questionId === args.currentControl.questionId) {
      return entry;
    }
  }

  return null;
}

export async function generateInterviewTurnPlan(args: {
  locale: InterviewLocale;
  displayName: string;
  transcript: InterviewTranscriptEntry[];
  jobContext: InterviewJobContext;
  currentControl?: InterviewControlState;
  questionHistory: InterviewQuestionHistoryEntry[];
  lastUserMessage: string;
  turnKind: string;
}): Promise<InterviewTurnPlan> {
  const remainingCustomQuestions = getRemainingCustomQuestions(args.questionHistory, args.jobContext.customQuestions);
  const fallbackQuestion = buildInterviewFallbackQuestion(args.locale, args.jobContext.role);
  const raw = await createGroqJsonCompletion({
    model: getGroqThinkingModel(),
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: buildInterviewThinkingSystemPrompt({
          locale: args.locale,
          jobContext: args.jobContext,
          currentControl: args.currentControl,
          remainingCustomQuestions,
          questionHistory: args.questionHistory,
          turnKind: args.turnKind,
        }),
      },
      {
        role: "user",
        content: buildInterviewThinkingUserPrompt({
          locale: args.locale,
          transcript: args.transcript,
          lastUserMessage: args.lastUserMessage,
        }),
      },
    ],
  });

  const normalized = parseInterviewThinkingModelOutput(raw);
  if ((!normalized.nextQuestion && !normalized.followUp) || normalized.usedFallback) {
    logWarn("mock-interview thinking: using fallback question", {
      used_fallback: normalized.usedFallback,
      turn_kind: args.turnKind,
    });
  }

  const nextQuestion =
    normalized.nextQuestion ||
    remainingCustomQuestions[0] ||
    fallbackQuestion;

  const isForcedRepeatTurn = args.turnKind === "silence" || args.turnKind === "timeout_warning";
  const isForcedAdvanceTurn = args.turnKind === "silence_escalate" || args.turnKind === "timeout";
  const currentQuestionHistoryEntry = findCurrentQuestionHistoryEntry({
    currentControl: args.currentControl,
    questionHistory: args.questionHistory,
  });

  const basePlan = createInterviewTurnPlan({
    locale: args.locale,
    displayName: sanitizeInterviewText(args.displayName),
    role: args.jobContext.role,
    decision: {
      action: isForcedAdvanceTurn ? "advance" : normalized.action,
      spokenPrompt: isForcedAdvanceTurn ? nextQuestion : normalized.spokenPrompt,
      nextQuestion,
      followUp: isForcedAdvanceTurn ? null : normalized.followUp,
      assessmentFocus: normalized.assessmentFocus,
      evaluationHint: normalized.evaluationHint,
      difficulty: normalized.difficulty,
      isOffTopic: normalized.isOffTopic,
      closingReason: normalized.closingReason,
    },
    currentControl: args.currentControl,
    questionHistory: args.questionHistory,
    remainingCustomQuestions,
    isOpeningTurn: args.turnKind === "opening",
  });

  if (isForcedRepeatTurn && args.currentControl) {
    const repeatedPrompt = sanitizeInterviewText(
      normalized.spokenPrompt ||
        normalized.followUp ||
        currentQuestionHistoryEntry?.prompt ||
        normalized.nextQuestion ||
        fallbackQuestion
    );
    const questionSource = args.currentControl.isFollowup
      ? "follow_up"
      : currentQuestionHistoryEntry?.source ?? "generated";
    const control = {
      questionId: args.currentControl.questionId,
      attempt: args.currentControl.attempt,
      isFollowup: args.currentControl.isFollowup,
      shouldEnd: false,
      endReason: null,
    };

    return {
      ...basePlan,
      plannerAction: "follow_up",
      spokenText: repeatedPrompt,
      nextQuestion: currentQuestionHistoryEntry?.prompt ?? repeatedPrompt,
      followUp: repeatedPrompt,
      questionSource,
      closingLine: null,
      control,
      speechInstructions: buildRealtimeSpeechInstructions({
        locale: args.locale,
        spokenText: repeatedPrompt,
        control,
      }),
    };
  }

  return basePlan;
}

export async function generateInterviewScorecard(args: {
  locale: InterviewLocale;
  transcript: InterviewTranscriptEntry[];
  jobContext: InterviewJobContext;
}): Promise<InterviewScorecard> {
  const raw = await createGroqJsonCompletion({
    model: getGroqScoringModel(),
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: buildInterviewScoringSystemPrompt({
          locale: args.locale,
          jobContext: args.jobContext,
        }),
      },
      {
        role: "user",
        content: buildInterviewScoringUserPrompt({
          locale: args.locale,
          transcript: args.transcript,
        }),
      },
    ],
  });

  const normalized = parseInterviewScoreModelOutput(raw);
  if (normalized.usedFallback) {
    throw new Error("Scoring model returned invalid structured output.");
  }

  const score = computeDeterministicInterviewOverallScore({
    technical: normalized.technical,
    problemSolving: normalized.problemSolving ?? 50,
    communication: normalized.communication,
    roleFit: normalized.roleFit,
  });

  return {
    score,
    verdict: normalized.verdict,
    strengths: normalized.strengths,
    weaknesses: normalized.weaknesses,
    communication: normalized.communication,
    technical: normalized.technical,
    roleFit: normalized.roleFit,
    problemSolving: normalized.problemSolving,
    evidenceQuality: normalized.evidenceQuality,
    summary: normalized.summary,
    usedFallback: false,
  };
}
