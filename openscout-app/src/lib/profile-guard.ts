import type { SupabaseClient } from "@supabase/supabase-js";

/** Required profile fields for job application and mock interview */
const REQUIRED_PROFILE_FIELDS = ["first_name", "last_name", "email", "location"] as const;

export type ProfileGuardResult = {
  profileComplete: boolean;
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

  const missingProfileFields: string[] = [];
  for (const field of REQUIRED_PROFILE_FIELDS) {
    const value = profile?.[field];
    if (value === undefined || value === null || String(value).trim() === "") {
      const label =
        field === "first_name"
          ? "First name"
          : field === "last_name"
            ? "Last name"
            : field === "email"
              ? "Email"
              : "Location";
      missingProfileFields.push(label);
    }
  }
  const profileComplete = missingProfileFields.length === 0;
  const hasCv =
    cvRes.data != null || !!(privateRow?.cv_file_url) || !!(privateRow?.cv_raw_text);
  const canApplyOrInterview = profileComplete && hasCv;

  return {
    profileComplete,
    hasCv,
    canApplyOrInterview,
    missingProfileFields,
  };
}
