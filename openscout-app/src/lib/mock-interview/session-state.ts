export type MockInterviewSessionStep = "mic-test" | "interview" | "goodbye" | "processing";

export const AUTO_LISTEN_AFTER_ASSISTANT_MS = 0;
export const LOCAL_SPEECH_END_COMMIT_DELAY_MS = 4_000;
export const LOCAL_LISTENING_IDLE_TIMEOUT_MS = 7_000;

export function getNextSilenceTransition(currentStrike: number): {
  nextStrike: number;
  turnKind: "silence" | "silence_escalate";
} {
  const shouldEscalate = currentStrike >= 1;
  return {
    nextStrike: shouldEscalate ? 0 : 1,
    turnKind: shouldEscalate ? "silence_escalate" : "silence",
  };
}

export function canUseManualMicCommit(args: {
  step: MockInterviewSessionStep;
  isSessionReady: boolean;
  isListening: boolean;
  isAiResponding: boolean;
  isAiSpeaking: boolean;
}): boolean {
  return (
    args.step === "interview" &&
    args.isSessionReady &&
    args.isListening &&
    !args.isAiResponding &&
    !args.isAiSpeaking
  );
}

export function isMicLocked(args: {
  step: MockInterviewSessionStep;
  isSessionReady: boolean;
  isListening: boolean;
  isAiResponding: boolean;
  isAiSpeaking: boolean;
}): boolean {
  return (
    args.step !== "interview" ||
    !args.isSessionReady ||
    args.isAiResponding ||
    args.isAiSpeaking
  );
}
