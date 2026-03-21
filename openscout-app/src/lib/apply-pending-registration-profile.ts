import type { SupabaseClient } from "@supabase/supabase-js";

/** sessionStorage key for profile draft when email confirmation is required before session exists */
export const PENDING_CANDIDATE_PROFILE_KEY = "pending_candidate_profile";

/**
 * Merges registration-time profile JSON from sessionStorage into Supabase (same rules as dashboard).
 * Safe to call on every load; removes the key after a successful merge attempt.
 */
export async function applyPendingCandidateProfileIfAny(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string | undefined
): Promise<void> {
  if (typeof window === "undefined") return;
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(PENDING_CANDIDATE_PROFILE_KEY);
  } catch {
    return;
  }
  if (!raw) return;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }

  const hasPayload =
    !!(parsed.first_name || parsed.last_name || parsed.location) ||
    !!parsed.professional_summary ||
    ((parsed.work_experiences as unknown[] | undefined)?.length ?? 0) > 0 ||
    ((parsed.educations as unknown[] | undefined)?.length ?? 0) > 0 ||
    !!(parsed.job_search_status || parsed.available_start || parsed.domain) ||
    !!(parsed.linkedin || parsed.github || parsed.portfolio);

  if (!hasPayload) {
    try {
      sessionStorage.removeItem(PENDING_CANDIDATE_PROFILE_KEY);
    } catch {}
    return;
  }

  try {
    if (parsed.first_name || parsed.last_name || parsed.location || parsed.professional_summary) {
      await supabase.from("profiles").upsert({
        user_id: userId,
        first_name: (parsed.first_name as string) ?? "",
        last_name: (parsed.last_name as string) ?? "",
        email: userEmail ?? "",
        location: (parsed.location as string) ?? "",
        professional_summary: (parsed.professional_summary as string) ?? "",
        updated_at: new Date().toISOString(),
      });
    }

    const we = parsed.work_experiences as Array<Record<string, unknown>> | undefined;
    if (we && we.length > 0) {
      await supabase.from("work_experiences").delete().eq("user_id", userId);
      for (let i = 0; i < we.length; i++) {
        await supabase.from("work_experiences").insert({
          user_id: userId,
          company_name: we[i].company_name,
          job_title: we[i].job_title,
          start_date: we[i].start_date || null,
          end_date: we[i].end_date || null,
          employment_type: we[i].employment_type || null,
          location: we[i].location || null,
          is_remote: (we[i].is_remote as boolean) ?? false,
          description: we[i].description || null,
          highlights: (we[i].highlights as string[]) || [],
          sort_order: i,
        });
      }
    }

    const eds = parsed.educations as Array<Record<string, unknown>> | undefined;
    if (eds && eds.length > 0) {
      await supabase.from("educations").delete().eq("user_id", userId);
      for (let i = 0; i < eds.length; i++) {
        await supabase.from("educations").insert({
          user_id: userId,
          institution: eds[i].institution,
          location: eds[i].location || null,
          degree_type: eds[i].degree_type || null,
          field_of_study: eds[i].field_of_study || null,
          start_year: eds[i].start_year ? parseInt(String(eds[i].start_year), 10) : null,
          end_year: eds[i].end_year ? parseInt(String(eds[i].end_year), 10) : null,
          completed: (eds[i].completed as boolean) ?? true,
          sort_order: i,
        });
      }
    }

    if (parsed.job_search_status || parsed.available_start || parsed.domain) {
      await supabase.from("job_preferences").upsert({
        user_id: userId,
        job_search_status: (parsed.job_search_status as string) || "actively_looking",
        available_start: (parsed.available_start as string) || "within_1_month",
        domain: (parsed.domain as string) || "engineering",
        updated_at: new Date().toISOString(),
      });
    }

    if (parsed.linkedin || parsed.github || parsed.portfolio) {
      await supabase.from("professional_links").upsert({
        user_id: userId,
        linkedin: (parsed.linkedin as string) || null,
        github: (parsed.github as string) || null,
        portfolio: (parsed.portfolio as string) || null,
        updated_at: new Date().toISOString(),
      });
    }
  } catch {
    return;
  }

  try {
    sessionStorage.removeItem(PENDING_CANDIDATE_PROFILE_KEY);
  } catch {}
}
