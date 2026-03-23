/** Client-safe helpers for interview result sharing (no server imports). */

export function interviewResultViralText(score: number, jobCategory: string): string {
  const role = jobCategory?.trim() || "practice";
  return `Scored ${score}/100 on an AI ${role} interview with OpenScout — verified feedback, no transcript on the public link. Practice your own run:`;
}

export function buildPublicInterviewResultPath(id: string, opts?: { anon?: boolean }): string {
  const base = `/result/${encodeURIComponent(id.trim())}`;
  return opts?.anon ? `${base}?anon=1` : base;
}
