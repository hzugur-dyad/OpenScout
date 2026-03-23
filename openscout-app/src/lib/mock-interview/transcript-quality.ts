import { ALL_INTERVIEW_CONTRACT_LINES } from "@/lib/mock-interview/interview-contract-messages";

export type InterviewTranscriptQuality = {
  /** True when timeouts, silence cues, or extremely thin user turns dominate */
  isLowSignal: boolean;
  /** Share of user turns that are exactly a synthetic contract line */
  syntheticTurnRatio: number;
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
      syntheticTurnRatio: 1,
      averageUserTurnChars: 0,
      userTurnCount: 0,
      scoreCap: 45,
    };
  }

  let charSum = 0;
  let synthetic = 0;
  let shortSubstantive = 0;
  for (const u of userTurns) {
    charSum += u.length;
    if (isSyntheticTurn(u)) synthetic++;
    else if (u.length < 12) shortSubstantive++;
  }

  const averageUserTurnChars = charSum / userTurnCount;
  const syntheticTurnRatio = synthetic / userTurnCount;
  const shortRatio = shortSubstantive / userTurnCount;

  const isLowSignal =
    userTurnCount < 4 ||
    averageUserTurnChars < 22 ||
    syntheticTurnRatio >= 0.34 ||
    (syntheticTurnRatio >= 0.2 && shortRatio >= 0.5);

  let scoreCap: number | null = null;
  if (isLowSignal) {
    if (syntheticTurnRatio >= 0.45 || averageUserTurnChars < 14) scoreCap = 48;
    else if (syntheticTurnRatio >= 0.3 || userTurnCount < 5) scoreCap = 52;
    else scoreCap = 58;
  }

  return {
    isLowSignal,
    syntheticTurnRatio,
    averageUserTurnChars,
    userTurnCount,
    scoreCap,
  };
}
