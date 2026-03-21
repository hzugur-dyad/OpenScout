import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { slugifyPublicProfileHandle } from "@/lib/public-profile-slug";

/**
 * Assigns profiles.public_profile_slug for a candidate if missing. Uses service role for conflict checks.
 */
export async function ensurePublicProfileSlugForUser(
  userId: string,
  firstName: string | null | undefined
): Promise<string | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return null;

  const admin = createAdminClient();

  const { data: current } = await admin
    .from("profiles")
    .select("public_profile_slug, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (!current || current.role === "employer") return null;

  const existing =
    typeof current.public_profile_slug === "string" ? current.public_profile_slug.trim() : "";
  if (existing) return existing;

  const baseRaw = slugifyPublicProfileHandle(firstName ?? "candidate");
  const base = baseRaw.slice(0, 40);

  for (let i = 0; i < 80; i++) {
    const candidate = i === 0 ? base : `${base}-${i}`;
    const { data: conflict } = await admin
      .from("profiles")
      .select("user_id")
      .eq("public_profile_slug", candidate)
      .maybeSingle();

    if (conflict && (conflict as { user_id: string }).user_id !== userId) {
      continue;
    }

    const { error } = await admin
      .from("profiles")
      .update({
        public_profile_slug: candidate,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (!error) return candidate;
  }

  const suffix = userId.replace(/-/g, "").slice(0, 8);
  const fallback = `${base}-${suffix}`;
  await admin
    .from("profiles")
    .update({ public_profile_slug: fallback, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  return fallback;
}
