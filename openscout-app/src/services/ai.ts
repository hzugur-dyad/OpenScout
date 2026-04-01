import type { InterviewLocale } from "@/lib/interview-locale";
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
    buildInterviewFallbackQuestion(args.locale, args.jobContext.role);

  return createInterviewTurnPlan({
    locale: args.locale,
    displayName: sanitizeInterviewText(args.displayName),
    role: args.jobContext.role,
    decision: {
      nextQuestion,
      followUp: normalized.followUp,
      evaluationHint: normalized.evaluationHint,
      difficulty: normalized.difficulty,
      isOffTopic: normalized.isOffTopic,
    },
    currentControl: args.currentControl,
    questionHistory: args.questionHistory,
    remainingCustomQuestions,
    isOpeningTurn: args.turnKind === "opening",
  });
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

  return {
    score: normalized.score,
    verdict: normalized.verdict,
    strengths: normalized.strengths,
    weaknesses: normalized.weaknesses,
    communication: normalized.communication,
    technical: normalized.technical,
    problemSolving: normalized.problemSolving,
    summary: normalized.summary,
    usedFallback: false,
  };
}
