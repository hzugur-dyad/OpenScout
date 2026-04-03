import {
  ALL_INTERVIEW_CONTRACT_LINES,
  INTERVIEW_CONTRACT_USER_LINES,
} from "@/lib/mock-interview/interview-contract-messages";

export type InterviewTranscriptQuality = {
  /** True when timeouts, silence cues, or extremely thin user turns dominate */
  isLowSignal: boolean;
  signalStrength: "none" | "weak" | "moderate" | "strong";
  /** Share of user turns that are exactly a synthetic contract line */
  syntheticTurnRatio: number;
  unansweredTurnCount: number;
  averageUserTurnChars: number;
  userTurnCount: number;
  /** When set, overall score should not exceed this after model evaluation */
  scoreCap: number | null;
};

function parseUserTurns(transcript: string): string[] {
  const out: string[] = [];
  for (const line of transcript.split("\n")) {
    const m = line.match(/^user:\s*(.*)$/i);
    if (m) out.push(m[1].trim());
  }
  return out;
}

function isSyntheticTurn(content: string): boolean {
  const t = content.trim();
  return ALL_INTERVIEW_CONTRACT_LINES.some((line) => t === line);
}

function isUnansweredTurn(content: string): boolean {
  const t = content.trim();
  return (
    t === INTERVIEW_CONTRACT_USER_LINES.en.timeout ||
    t === INTERVIEW_CONTRACT_USER_LINES.tr.timeout
  );
}

/**
 * Heuristic transcript quality for post-interview scoring — avoids inflated scores
 * when the conversation is mostly silence markers or one-word answers.
 */
export function assessInterviewTranscriptQuality(transcript: string): InterviewTranscriptQuality {
  const userTurns = parseUserTurns(transcript);
  const userTurnCount = userTurns.length;
  if (userTurnCount === 0) {
    return {
      isLowSignal: true,
      signalStrength: "none",
      syntheticTurnRatio: 1,
      unansweredTurnCount: 0,
      averageUserTurnChars: 0,
      userTurnCount: 0,
      scoreCap: 0,
    };
  }

  let charSum = 0;
  let synthetic = 0;
  let unanswered = 0;
  let shortSubstantive = 0;
  for (const u of userTurns) {
    charSum += u.length;
    if (isSyntheticTurn(u)) {
      synthetic++;
      if (isUnansweredTurn(u)) unanswered++;
    } else if (u.length < 12) {
      shortSubstantive++;
    }
  }

  const averageUserTurnChars = charSum / userTurnCount;
  const syntheticTurnRatio = synthetic / userTurnCount;
  const shortRatio = shortSubstantive / userTurnCount;
  const unansweredRatio = unanswered / userTurnCount;

  const signalStrength =
    syntheticTurnRatio >= 0.75 || unansweredRatio >= 0.75
      ? "none"
      : averageUserTurnChars < 18 ||
          syntheticTurnRatio >= 0.34 ||
          (syntheticTurnRatio >= 0.2 && shortRatio >= 0.5)
        ? "weak"
        : userTurnCount < 3 || averageUserTurnChars < 45 || shortRatio >= 0.4
          ? "moderate"
          : "strong";

  const isLowSignal = signalStrength === "none" || signalStrength === "weak";

  let scoreCap: number | null = null;
  if (isLowSignal) {
    scoreCap = signalStrength === "none" ? 0 : 20;
  }

  return {
    isLowSignal,
    signalStrength,
    syntheticTurnRatio,
    unansweredTurnCount: unanswered,
    averageUserTurnChars,
    userTurnCount,
    scoreCap,
  };
}
