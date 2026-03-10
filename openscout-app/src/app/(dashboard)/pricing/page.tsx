"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { PLAN_LIMITS, type CandidatePlan, type UsageFeature, getUserPlan } from "@/lib/usage";
import { Check } from "lucide-react";

const plans = [
  {
    id: "free" as CandidatePlan,
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "1 CV analysis per week",
      "1 mock interview per week",
      "Basic dashboard",
      "Job browsing",
    ],
  },
  {
    id: "plus" as CandidatePlan,
    name: "Plus",
    price: "$9.99",
    period: "/month",
    features: [
      "5 CV analyses per week",
      "5 mock interviews per week",
      "Detailed reports",
      "Priority support",
      "Job browsing & applications",
    ],
  },
  {
    id: "pro" as CandidatePlan,
    name: "Pro",
    price: "$19.99",
    period: "/month",
    popular: true,
    features: [
      "Unlimited CV analyses",
      "Unlimited mock interviews",
      "Full detailed reports",
      "Priority support",
      "Job browsing & applications",
    ],
  },
];

export default function CandidatePricingPage() {
  const supabase = createClient();
  const [currentPlan, setCurrentPlan] = useState<CandidatePlan>("free");
  const [usage, setUsage] = useState<Record<UsageFeature, number>>({ cv_analysis: 0, mock_interview: 0 });
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("user_id", user.id)
        .maybeSingle();
      setCurrentPlan(getUserPlan(profile?.plan));

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { count: cvCount } = await supabase
        .from("usage_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("feature", "cv_analysis")
        .gte("created_at", weekAgo.toISOString());
      const { count: mockCount } = await supabase
        .from("usage_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("feature", "mock_interview")
        .gte("created_at", weekAgo.toISOString());
      setUsage({ cv_analysis: cvCount ?? 0, mock_interview: mockCount ?? 0 });
    }
    load();
  }, [supabase]);

  async function handleUpgrade(planId: CandidatePlan) {
    if (planId === "free") return;
    setLoading(planId);
    try {
      const res = await fetch("/api/candidate/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Could not start checkout");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  const cvLimit = PLAN_LIMITS[currentPlan].cv_analysis;
  const mockLimit = PLAN_LIMITS[currentPlan].mock_interview;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Upgrade Your Plan</h1>
      <p className="mt-1 text-gray-500">Get more CV analyses and mock interviews each week.</p>

      <div className="mt-4 rounded-[10px] border border-[var(--border)] bg-white p-4">
        <p className="text-sm text-gray-600">
          Current plan: <span className="font-semibold capitalize">{currentPlan}</span>
          {" — "}
          CV analysis: {usage.cv_analysis}/{cvLimit === Infinity ? "∞" : cvLimit} this week
          {" · "}
          Mock interview: {usage.mock_interview}/{mockLimit === Infinity ? "∞" : mockLimit} this week
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-[10px] border bg-white p-6 shadow-soft ${
                plan.popular
                  ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/20"
                  : "border-[var(--border)]"
              }`}
            >
              {plan.popular && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: "var(--primary)" }}
                >
                  Most Popular
                </span>
              )}
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <div className="mt-2">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-sm text-gray-500">{plan.period}</span>
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--primary)" }} />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : plan.id === "free" ? (
                  <Button variant="outline" className="w-full" disabled>
                    Free
                  </Button>
                ) : (
                  <Button
                    variant={plan.popular ? "primary" : "secondary"}
                    className="w-full"
                    isLoading={loading === plan.id}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    Upgrade to {plan.name}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
