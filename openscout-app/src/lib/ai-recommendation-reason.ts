/**
 * Deterministic hiring recommendation text for employers (no LLM).
 * Stored on job_applications.ai_recommendation_reason.
 */

export type RecommendationInputs = {
  cvScore: number | null;
  interviewScore: number | null;
  technical: number | null;
  communication: number | null;
  problemSolving: number | null;
  minCvScore?: number | null;
};

export function computeAiRecommendationReason(input: RecommendationInputs): string {
  const { cvScore, interviewScore, technical, communication, problemSolving, minCvScore } = input;
  const parts: string[] = [];

  if (typeof interviewScore === "number") {
    if (interviewScore >= 80) parts.push("Strong interview performance overall.");
    else if (interviewScore >= 65) parts.push("Solid interview performance with room to probe in live rounds.");
    else if (interviewScore >= 50) parts.push("Mixed interview signal; confirm depth in areas that matter for the role.");
    else parts.push("Interview signal is weak relative to typical hires; verify fundamentals before advancing.");
  } else {
    parts.push("Interview score unavailable.");
  }

  if (typeof cvScore === "number" && typeof minCvScore === "number" && minCvScore > 0) {
    if (cvScore >= minCvScore + 10) parts.push("CV clears the role bar comfortably.");
    else if (cvScore >= minCvScore) parts.push("CV meets the posted minimum.");
    else parts.push("CV is below the job minimum — unusual if application was allowed; re-check screening rules.");
  } else if (typeof cvScore === "number") {
    parts.push(`CV fit score ${cvScore}/100.`);
  }

  const dims = [technical, communication, problemSolving].filter((n): n is number => typeof n === "number");
  if (dims.length >= 2) {
    const max = Math.max(...dims);
    const min = Math.min(...dims);
    if (max - min >= 25) {
      parts.push("Large spread between dimension scores — review inconsistent areas in the written report.");
    }
  }

  return parts.join(" ");
}
