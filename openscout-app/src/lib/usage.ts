import type { SupabaseClient } from "@supabase/supabase-js";

export type CandidatePlan = "free" | "plus" | "pro";
export type UsageFeature = "cv_analysis" | "mock_interview";

export const PLAN_LIMITS: Record<CandidatePlan, Record<UsageFeature, number>> = {
  free: { cv_analysis: 1, mock_interview: 1 },
  plus: { cv_analysis: 5, mock_interview: 5 },
  pro: { cv_analysis: Infinity, mock_interview: Infinity },
};

function getWeekAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

export async function getWeeklyUsage(
  supabase: SupabaseClient,
  userId: string,
  feature: UsageFeature
): Promise<number> {
  const { count } = await supabase
    .from("usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", feature)
    .gte("created_at", getWeekAgo());
  return count ?? 0;
}

export async function canUseFeature(
  supabase: SupabaseClient,
  userId: string,
  feature: UsageFeature,
  plan: CandidatePlan
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limit = PLAN_LIMITS[plan][feature];
  if (limit === Infinity) return { allowed: true, used: 0, limit };
  const used = await getWeeklyUsage(supabase, userId, feature);
  return { allowed: used < limit, used, limit };
}

export async function logUsage(
  supabase: SupabaseClient,
  userId: string,
  feature: UsageFeature
): Promise<void> {
  await supabase.from("usage_logs").insert({ user_id: userId, feature });
}

export function getUserPlan(profilePlan: string | undefined | null): CandidatePlan {
  if (profilePlan === "plus" || profilePlan === "pro") return profilePlan;
  return "free";
}
