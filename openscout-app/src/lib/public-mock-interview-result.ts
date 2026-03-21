import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { computeHiringScore, hiringFitTagFromScore } from "@/lib/hiring-score";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPublicMockInterviewId(id: string): boolean {
  return typeof id === "string" && UUID_RE.test(id.trim());
}

export type PublicMockInterviewData = {
  score: number;
  hiringScore: number;
  fitTag: ReturnType<typeof hiringFitTagFromScore>;
  strengths: string[];
  improvements: string[];
  job_category: string;
};

export type FetchPublicMockInterviewResult =
  | { status: "ok"; data: PublicMockInterviewData }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "invalid" };

export async function fetchPublicMockInterviewById(
  rawId: string
): Promise<FetchPublicMockInterviewResult> {
  const id = rawId?.trim();
  if (!id || !isPublicMockInterviewId(id)) {
    return { status: "invalid" };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return { status: "unavailable" };
  }

  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from("mock_interviews")
    .select("user_id, score, report, job_category")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("public mock interview fetch:", error);
    return { status: "not_found" };
  }
  if (!row) {
    return { status: "not_found" };
  }

  const report = (row.report as Record<string, unknown>) ?? {};
  const strengths = Array.isArray(report.strengths)
    ? (report.strengths as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const improvements = Array.isArray(report.improvements)
    ? (report.improvements as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const technical_score = typeof report.technical_score === "number" ? report.technical_score : null;
  const communication_score =
    typeof report.communication_score === "number" ? report.communication_score : null;
  const problem_solving_score =
    typeof report.problem_solving_score === "number" ? report.problem_solving_score : null;
  const score = typeof row.score === "number" ? row.score : 0;

  const hiringScore = computeHiringScore({
    overall_score: score,
    technical_score,
    communication_score,
    problem_solving_score,
  });
  const fitTag = hiringFitTagFromScore(hiringScore);

  return {
    status: "ok",
    data: {
      score,
      hiringScore,
      fitTag,
      strengths,
      improvements,
      job_category: typeof row.job_category === "string" ? row.job_category : "",
    },
  };
}

/** Server-only: resolves first name for “Shared by …” without putting auth user id in the public result payload. */
export async function fetchSharedByFirstNameForResultId(rawId: string): Promise<string | null> {
  const id = rawId?.trim();
  if (!id || !isPublicMockInterviewId(id)) return null;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return null;
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("mock_interviews")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  const uid = row?.user_id;
  if (typeof uid !== "string" || !uid.trim()) return null;
  return fetchSharedByFirstName(uid);
}

export async function fetchSharedByFirstName(userId: string): Promise<string | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return null;
  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name")
    .eq("user_id", userId)
    .maybeSingle();
  const n = profile?.first_name?.trim();
  return n || null;
}
