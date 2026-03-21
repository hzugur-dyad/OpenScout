import type { SupabaseClient } from "@supabase/supabase-js";
import { computeCvReadiness } from "@/lib/cv-readiness";

const PROFILE_FIELD_LABEL: Record<string, string> = {
  first_name: "First name",
  last_name: "Last name",
  email: "Email",
  location: "Location",
};

export type ProfileGuardResult = {
  profileComplete: boolean;
  /** CV file or raw text stored in profile_private. */
  hasUploadedCv: boolean;
  /** At least one cv_analyses row for this user. */
  hasCvAnalysis: boolean;
  /** True if uploaded CV on file or any CV analysis exists. */
  hasCv: boolean;
  canApplyOrInterview: boolean;
  missingProfileFields: string[];
};

export async function checkProfileAndCv(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileGuardResult> {
  const [profileRes, privateRes, cvRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, email, location")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("profile_private")
      .select("cv_file_url, cv_raw_text")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("cv_analyses")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileRes.data as {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    location?: string | null;
  } | null;

  const privateRow = privateRes.data as {
    cv_file_url?: string | null;
    cv_raw_text?: string | null;
  } | null;

  const c = computeCvReadiness({
    profile,
    cvFileUrl: privateRow?.cv_file_url,
    cvRawText: privateRow?.cv_raw_text,
    hasCvAnalysisRow: cvRes.data != null,
  });

  const missingProfileFields = c.missingProfileFieldKeys.map((k) => PROFILE_FIELD_LABEL[k] ?? k);

  return {
    profileComplete: c.profileComplete,
    hasUploadedCv: c.hasUploadedCv,
    hasCvAnalysis: c.hasCvAnalysis,
    hasCv: c.hasUploadedCv || c.hasCvAnalysis,
    canApplyOrInterview: c.canAccessFlow,
    missingProfileFields,
  };
}
