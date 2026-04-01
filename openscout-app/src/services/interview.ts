import type { InterviewLocale } from "@/lib/interview-locale";

export type InterviewTranscriptEntry = {
  role: "user" | "assistant";
  content: string;
};

export type InterviewDifficulty = "easy" | "medium" | "hard";

export type InterviewQuestionSource = "custom" | "generated" | "follow_up" | "closing";

export type InterviewQuestionHistoryEntry = {
  questionId: string;
  prompt: string;
  source: "custom" | "generated";
  difficulty?: InterviewDifficulty;
};

export type InterviewControlState = {
  questionId: string;
  attempt: number;
  isFollowup: boolean;
};

export type InterviewJobContext = {
  role: string;
  description: string;
  requirements: string;
  customQuestions: string[];
};

export type InterviewThinkingDecision = {
  nextQuestion: string;
  followUp: string | null;
  evaluationHint: string;
  difficulty: InterviewDifficulty;
  isOffTopic: boolean;
};

export type InterviewTurnPlan = {
  nextQuestion: string;
  followUp: string | null;
  evaluationHint: string;
  difficulty: InterviewDifficulty;
  isOffTopic: boolean;
  questionSource: InterviewQuestionSource;
  closingLine: string | null;
  control: {
    questionId: string;
    attempt: number;
    isFollowup: boolean;
    shouldEnd: boolean;
    endReason: string | null;
  };
  speechInstructions: string;
};

export type InterviewVerdict = "strong hire" | "hire" | "no hire";

export type InterviewScorecard = {
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

const TARGET_MAIN_QUESTIONS = 8;
const MAX_MAIN_QUESTIONS = 10;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function sanitizeInterviewText(value: string): string {
  return collapseWhitespace(value).slice(0, 10_000);
}

export function buildInterviewQuestionId(
  questionNumber: number,
  source: Exclude<InterviewQuestionSource, "closing">
): string {
  const prefix =
    source === "custom"
      ? "custom"
      : source === "generated"
        ? "generated"
        : "followup";
  return `q_${String(Math.max(1, questionNumber)).padStart(2, "0")}_${prefix}`;
}

export function buildInterviewOpeningLine(
  locale: InterviewLocale,
  displayName: string,
  role: string,
  question: string
): string {
  const safeName = sanitizeInterviewText(displayName) || (locale === "tr" ? "aday" : "there");
  const safeRole = sanitizeInterviewText(role) || (locale === "tr" ? "bu rol" : "this role");
  const safeQuestion = sanitizeInterviewText(question);
  return locale === "tr"
    ? `Merhaba ${safeName}. ${safeRole} rolu icin kisa bir gorusme yapacagiz. Kisa ve net ilerleyecegim. ${safeQuestion}`
    : `Hello ${safeName}. We'll run a short interview for the ${safeRole} role. I'll keep it concise and direct. ${safeQuestion}`;
}

export function buildInterviewClosingLine(locale: InterviewLocale, displayName: string): string {
  const safeName = sanitizeInterviewText(displayName) || (locale === "tr" ? "aday" : "there");
  return locale === "tr"
    ? `Gorusme icin tesekkur ederim ${safeName}. Yanitlarini simdi degerlendirip sonucunu hazirlayacagim.`
    : `Thank you for your time, ${safeName}. I'll evaluate your answers and prepare your result now.`;
}

export function buildInterviewFallbackQuestion(locale: InterviewLocale, role: string): string {
  const safeRole = sanitizeInterviewText(role) || (locale === "tr" ? "bu rol" : "this role");
  return locale === "tr"
    ? `${safeRole} rolunde son donemde cozdugunuz zor bir problemi ve nasil yaklastiginizi anlatir misiniz?`
    : `Tell me about a challenging problem you solved recently in a ${safeRole} role and how you approached it.`;
}

export function buildInterviewOffTopicRedirect(locale: InterviewLocale): string {
  return locale === "tr" ? "Sorumuza geri donelim." : "Let's come back to the question.";
}

export function buildInterviewContextSummary(context: InterviewJobContext): string {
  const parts = [
    context.role ? `Role: ${sanitizeInterviewText(context.role)}` : "",
    context.description ? `Description: ${sanitizeInterviewText(context.description)}` : "",
    context.requirements ? `Requirements: ${sanitizeInterviewText(context.requirements)}` : "",
  ].filter(Boolean);
  return parts.join("\n");
}

export function formatTranscriptForPrompt(transcript: InterviewTranscriptEntry[]): string {
  if (transcript.length === 0) return "(no transcript yet)";
  return transcript
    .map((entry) => `${entry.role}: ${sanitizeInterviewText(entry.content)}`)
    .join("\n");
}

export function getRemainingCustomQuestions(
  questionHistory: InterviewQuestionHistoryEntry[],
  customQuestions: string[]
): string[] {
  const askedCustomCount = questionHistory.filter((entry) => entry.source === "custom").length;
  return customQuestions.slice(askedCustomCount);
}

function shouldCloseInterview(args: {
  isOpeningTurn: boolean;
  hasFollowUp: boolean;
  questionHistory: InterviewQuestionHistoryEntry[];
  remainingCustomQuestions: string[];
}): boolean {
  if (args.isOpeningTurn) return false;
  if (args.hasFollowUp) return false;
  if (args.remainingCustomQuestions.length > 0) return false;
  if (args.questionHistory.length >= MAX_MAIN_QUESTIONS) return true;
  return args.questionHistory.length >= TARGET_MAIN_QUESTIONS;
}

function buildSpokenTurnText(args: {
  locale: InterviewLocale;
  displayName: string;
  role: string;
  isOpeningTurn: boolean;
  isOffTopic: boolean;
  spokenQuestion: string;
  shouldEnd: boolean;
  closingLine: string | null;
}): string {
  if (args.shouldEnd && args.closingLine) return args.closingLine;
  if (args.isOpeningTurn) {
    return buildInterviewOpeningLine(args.locale, args.displayName, args.role, args.spokenQuestion);
  }

  const parts = [
    args.isOffTopic ? buildInterviewOffTopicRedirect(args.locale) : "",
    args.spokenQuestion,
  ].filter(Boolean);
  return parts.join(" ");
}

export function buildRealtimeSpeechInstructions(args: {
  locale: InterviewLocale;
  displayName: string;
  role: string;
  isOpeningTurn: boolean;
  spokenQuestion: string;
  isOffTopic: boolean;
  shouldEnd: boolean;
  control: InterviewTurnPlan["control"];
  closingLine: string | null;
}): string {
  const spokenText = buildSpokenTurnText(args);
  const languageLabel = args.locale === "tr" ? "Turkish" : "English";

  return [
    "SERVER ORCHESTRATOR: follow every instruction in this block exactly.",
    `- Speak only in ${languageLabel}. Never mix languages.`,
    "- Use a senior recruiter tone: warm, serious, concise, and direct.",
    "- Say exactly the spoken text below and do not add any extra question, explanation, or meta-commentary.",
    `- SPOKEN_TEXT=${JSON.stringify(spokenText)}`,
    "- After speaking, call report_interview_state exactly once.",
    `- question_id=${JSON.stringify(args.control.questionId)}`,
    `- attempt=${args.control.attempt}`,
    `- is_followup=${args.control.isFollowup ? "true" : "false"}`,
    `- should_end=${args.control.shouldEnd ? "true" : "false"}`,
    `- end_reason=${JSON.stringify(args.control.endReason ?? "")}`,
  ].join("\n");
}

export function createInterviewTurnPlan(args: {
  locale: InterviewLocale;
  displayName: string;
  role: string;
  decision: InterviewThinkingDecision;
  currentControl?: InterviewControlState;
  questionHistory: InterviewQuestionHistoryEntry[];
  remainingCustomQuestions: string[];
  isOpeningTurn: boolean;
}): InterviewTurnPlan {
  const followUp = sanitizeInterviewText(args.decision.followUp ?? "");
  const nextQuestion = sanitizeInterviewText(args.decision.nextQuestion);
  const spokenQuestion = followUp || nextQuestion || buildInterviewFallbackQuestion(args.locale, args.role);
  const isFollowup = Boolean(followUp) && Boolean(args.currentControl?.questionId) && args.currentControl?.attempt === 1;
  const shouldEnd = shouldCloseInterview({
    isOpeningTurn: args.isOpeningTurn,
    hasFollowUp: isFollowup,
    questionHistory: args.questionHistory,
    remainingCustomQuestions: args.remainingCustomQuestions,
  });

  const questionSource: InterviewQuestionSource = shouldEnd
    ? "closing"
    : isFollowup
      ? "follow_up"
      : args.remainingCustomQuestions.length > 0
        ? "custom"
        : "generated";

  const questionId = isFollowup
    ? args.currentControl?.questionId ?? buildInterviewQuestionId(args.questionHistory.length + 1, "follow_up")
    : buildInterviewQuestionId(args.questionHistory.length + 1, questionSource === "custom" ? "custom" : "generated");

  const closingLine = shouldEnd ? buildInterviewClosingLine(args.locale, args.displayName) : null;
  const control = {
    questionId,
    attempt: isFollowup ? 2 : 1,
    isFollowup,
    shouldEnd,
    endReason: shouldEnd ? "target_questions_completed" : null,
  };

  return {
    nextQuestion,
    followUp: followUp || null,
    evaluationHint: sanitizeInterviewText(args.decision.evaluationHint),
    difficulty: args.decision.difficulty,
    isOffTopic: args.decision.isOffTopic,
    questionSource,
    closingLine,
    control,
    speechInstructions: buildRealtimeSpeechInstructions({
      locale: args.locale,
      displayName: args.displayName,
      role: args.role,
      isOpeningTurn: args.isOpeningTurn,
      spokenQuestion,
      isOffTopic: args.decision.isOffTopic,
      shouldEnd,
      control,
      closingLine,
    }),
  };
}
