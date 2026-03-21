/** Trend from up to 5 scores ordered oldest → newest (chronological). */
export type InterviewScoreTrend = "Improving" | "Declining" | "Stable";

export function interviewScoreTrendFromChronological(scores: number[]): {
  trend: InterviewScoreTrend;
  arrow: "↑" | "↓" | "→";
} {
  if (scores.length < 2) {
    return { trend: "Stable", arrow: "→" };
  }
  const first = scores[0];
  const last = scores[scores.length - 1];
  if (last > first) return { trend: "Improving", arrow: "↑" };
  if (last < first) return { trend: "Declining", arrow: "↓" };
  return { trend: "Stable", arrow: "→" };
}
