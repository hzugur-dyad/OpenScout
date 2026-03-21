import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import {
  computeHiringScore,
  hiringFitTagFromScore,
  hiringScoreInputsFromInterviewRow,
  type HiringFitTag,
} from "@/lib/hiring-score";

export type PublicCandidateProfileView = {
  slug: string;
  /** When true, only generic safe copy is shown. */
  hidden: boolean;
  firstName: string | null;
  targetRole: string | null;
  summary: string | null;
  bestScoutScore: number | null;
  bestHiringScore: number | null;
  hiringFitLabel: HiringFitTag | null;
  latestInterviewCategory: string | null;
  strengthsTop3: string[];
  latestResultId: string | null;
  latestPassSlug: string | null;
  latestEvaluatedRole: string | null;
  openToCategory: string | null;
  hasCompletedInterview: boolean;
};

export type FetchPublicCandidateProfileResult =
  | { status: "ok"; data: PublicCandidateProfileView }
  | { status: "not_found" }
  | { status: "unavailable" };

function parseStrengthsTop3(report: unknown): string[] {
  const r = report as { strengths?: unknown } | null;
  const arr = Array.isArray(r?.strengths)
    ? (r.strengths as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  return arr.slice(0, 3);
}

export async function fetchPublicCandidateProfileBySlug(
  rawSlug: string
): Promise<FetchPublicCandidateProfileResult> {
  const slug = rawSlug?.trim().toLowerCase();
  if (!slug) return { status: "not_found" };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return { status: "unavailable" };
  }

  const supabase = createAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, first_name, professional_summary, role, public_profile_hidden")
    .eq("public_profile_slug", slug)
    .maybeSingle();

  if (profileError) {
    console.error("public candidate profile:", profileError);
    return { status: "not_found" };
  }
  if (!profile) {
    return { status: "not_found" };
  }

  const userId = profile.user_id as string;
  const isEmployer = profile.role === "employer";
  if (isEmployer) {
    return { status: "not_found" };
  }

  const hidden = Boolean(profile.public_profile_hidden);

  const [{ data: prefs }, { data: interviews }, { data: passes }, { data: cvRows }] = await Promise.all([
    supabase
      .from("job_preferences")
      .select("desired_roles, domain")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("mock_interviews")
      .select("id, job_category, created_at, score, report")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("scout_credentials")
      .select("public_slug, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("cv_analyses")
      .select("job_category, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const rows = interviews ?? [];
  const hasCompletedInterview = rows.length > 0;

  let bestScoutScore: number | null = null;
  let bestHiringScore: number | null = null;
  let strengthsTop3: string[] = [];

  for (const r of rows) {
    const overall = typeof r.score === "number" ? r.score : null;
    if (overall != null && (bestScoutScore == null || overall > bestScoutScore)) {
      bestScoutScore = overall;
      strengthsTop3 = parseStrengthsTop3(r.report);
    }
    const hs = computeHiringScore(
      hiringScoreInputsFromInterviewRow({
        interview_score: r.score,
        interview_report: r.report,
      })
    );
    if (hs > (bestHiringScore ?? -1)) {
      bestHiringScore = hs;
    }
  }

  const latestInterviewCategory =
    rows[0]?.job_category && typeof rows[0].job_category === "string"
      ? rows[0].job_category
      : null;

  const latestResultId = rows[0]?.id && typeof rows[0].id === "string" ? rows[0].id : null;

  const latestPassSlug =
    passes?.[0]?.public_slug && typeof passes[0].public_slug === "string"
      ? passes[0].public_slug
      : null;

  const latestCv = cvRows?.[0];
  const latestEvaluatedRole =
    latestCv?.job_category && typeof latestCv.job_category === "string"
      ? latestCv.job_category
      : null;

  const desired = prefs?.desired_roles as string[] | null | undefined;
  const openToCategory =
    (Array.isArray(desired) && desired[0]?.trim()) ||
    (typeof prefs?.domain === "string" && prefs.domain.trim()) ||
    null;

  const targetRole = openToCategory || latestInterviewCategory || latestEvaluatedRole || null;

  const firstName =
    typeof profile.first_name === "string" && profile.first_name.trim()
      ? profile.first_name.trim()
      : null;
  const summary =
    typeof profile.professional_summary === "string" && profile.professional_summary.trim()
      ? profile.professional_summary.trim()
      : null;

  const hiringFitLabel =
    bestHiringScore != null ? hiringFitTagFromScore(bestHiringScore) : null;

  const data: PublicCandidateProfileView = {
    slug,
    hidden,
    firstName,
    targetRole,
    summary,
    bestScoutScore,
    bestHiringScore,
    hiringFitLabel,
    latestInterviewCategory,
    strengthsTop3,
    latestResultId,
    latestPassSlug,
    latestEvaluatedRole,
    openToCategory,
    hasCompletedInterview,
  };

  if (hidden) {
    return {
      status: "ok",
      data: {
        ...data,
        firstName: null,
        targetRole: null,
        summary: null,
        bestScoutScore: null,
        bestHiringScore: null,
        hiringFitLabel: null,
        latestInterviewCategory: null,
        strengthsTop3: [],
        latestResultId: null,
        latestPassSlug: null,
        latestEvaluatedRole: null,
        openToCategory: null,
        hasCompletedInterview: false,
      },
    };
  }

  return { status: "ok", data };
}
