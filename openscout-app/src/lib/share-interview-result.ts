/** Client-safe helpers for interview result sharing (no server imports). */

export function interviewResultViralText(score: number, jobCategory: string): string {
  const role = jobCategory?.trim() || "practice";
  return `I just scored ${score} in a ${role} interview. Try it yourself.`;
}

export function buildPublicInterviewResultPath(id: string, opts?: { anon?: boolean }): string {
  const base = `/result/${encodeURIComponent(id.trim())}`;
  return opts?.anon ? `${base}?anon=1` : base;
}
