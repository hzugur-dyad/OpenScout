import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensurePublicProfileSlugForUser } from "@/lib/allocate-public-profile-slug";
import { getSiteUrl } from "@/lib/seo/site";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await enforceRateLimit(request, user.id, {
    namespace: "candidate-public-profile-link",
    preset: "lenient",
  });
  if (limited) return limited;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, public_profile_slug")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.role === "employer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let slug = typeof profile?.public_profile_slug === "string" ? profile.public_profile_slug.trim() : "";
  if (!slug) {
    const created = await ensurePublicProfileSlugForUser(user.id, profile?.first_name);
    slug = created ?? "";
  }

  if (!slug) {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }

  const [{ data: prefs }, { data: interviews }] = await Promise.all([
    supabase.from("job_preferences").select("desired_roles, domain").eq("user_id", user.id).maybeSingle(),
    supabase.from("mock_interviews").select("score").eq("user_id", user.id),
  ]);

  const desired = prefs?.desired_roles as string[] | undefined;
  const role =
    (Array.isArray(desired) && desired[0]?.trim()) ||
    (typeof prefs?.domain === "string" && prefs.domain.trim()) ||
    null;

  let best_score: number | null = null;
  for (const r of interviews ?? []) {
    if (typeof r.score === "number") {
      if (best_score == null || r.score > best_score) best_score = r.score;
    }
  }

  const base = getSiteUrl();
  return NextResponse.json({
    slug,
    profileUrl: `${base}/u/${slug}`,
    analytics: { role: role ?? "unknown", best_score },
  });
}
