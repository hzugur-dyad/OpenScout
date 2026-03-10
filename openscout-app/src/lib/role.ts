import type { SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "candidate" | "employer";

/**
 * Server-side: get the current user's role from profiles.
 * Pass the Supabase client (from createClient() in server or middleware).
 * Returns null if not authenticated or profile/role not found.
 */
export async function getUserRole(
  supabase: SupabaseClient
): Promise<UserRole | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = data?.role;
  if (role === "candidate" || role === "employer") return role;
  return null;
}
