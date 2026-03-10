"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PLAN_LIMITS, getUserPlan, type CandidatePlan, type UsageFeature } from "@/lib/usage";

interface UsageBannerProps {
  feature: UsageFeature;
}

const featureLabel: Record<UsageFeature, string> = {
  cv_analysis: "CV analysis",
  mock_interview: "mock interview",
};

export function UsageBanner({ feature }: UsageBannerProps) {
  const [plan, setPlan] = useState<CandidatePlan>("free");
  const [used, setUsed] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("user_id", user.id)
        .maybeSingle();
      const p = getUserPlan(profile?.plan);
      setPlan(p);

      if (PLAN_LIMITS[p][feature] === Infinity) {
        setLoaded(true);
        return;
      }

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { count } = await supabase
        .from("usage_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("feature", feature)
        .gte("created_at", weekAgo.toISOString());
      setUsed(count ?? 0);
      setLoaded(true);
    }
    load();
  }, [supabase, feature]);

  if (!loaded) return null;

  const limit = PLAN_LIMITS[plan][feature];
  if (limit === Infinity) return null;

  const remaining = Math.max(0, limit - used);
  const isExhausted = remaining === 0;
  const label = featureLabel[feature];

  if (isExhausted) {
    return (
      <div className="mb-6 rounded-[10px] border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/40">
        <p className="font-medium text-red-800 dark:text-red-300">
          You've used all {limit} {label} {limit === 1 ? "attempt" : "attempts"} this week.
        </p>
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
          Upgrade your plan to get more.{" "}
          <Link href="/pricing" className="font-semibold underline">
            View plans
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-[10px] border border-[var(--border)] bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-sm text-gray-600 dark:text-zinc-300">
        <span className="font-medium capitalize">{plan}</span> plan — {remaining} of {limit} {label} {limit === 1 ? "use" : "uses"} remaining this week.
        {plan === "free" && (
          <>
            {" "}
            <Link href="/pricing" className="font-medium text-primary hover:underline">
              Upgrade
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
