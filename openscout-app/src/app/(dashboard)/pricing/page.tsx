"use client";

import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { PLAN_LIMITS, type CandidatePlan, type UsageFeature, getUserPlan } from "@/lib/usage";
import { Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type PlanDef = {
  id: CandidatePlan;
  name: string;
  price: string;
  period: string;
  blurb: string;
  features: string[];
  featured?: boolean;
};

const plans: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    blurb: "Core tools to get started",
    features: [
      "1 CV analysis per week",
      "1 mock interview per week",
      "Basic dashboard",
      "Job browsing",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    price: "$9.99",
    period: "/month",
    blurb: "More practice each week",
    features: [
      "5 CV analyses per week",
      "5 mock interviews per week",
      "Detailed reports",
      "Priority support",
      "Job browsing and applications",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19.99",
    period: "/month",
    blurb: "Unlimited runway for serious prep",
    featured: true,
    features: [
      "Unlimited CV analyses",
      "Unlimited mock interviews",
      "Full detailed reports",
      "Priority support",
      "Job browsing and applications",
    ],
  },
];

const motionEase = [0.16, 1, 0.3, 1] as const;

function listParentVariants(reduceMotion: boolean) {
  if (reduceMotion) {
    return { hidden: { opacity: 1 }, show: { opacity: 1, transition: { duration: 0 } } };
  }
  return {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.03 },
    },
  };
}

function listItemVariants(reduceMotion: boolean) {
  if (reduceMotion) {
    return {
      hidden: { opacity: 1, y: 0 },
      show: { opacity: 1, y: 0, transition: { duration: 0 } },
    };
  }
  return {
    hidden: { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.35, ease: motionEase },
    },
  };
}

const btnMinimal =
  "rounded-md shadow-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 dark:focus:ring-zinc-500 dark:focus:ring-offset-zinc-950";

const btnPrimaryMinimal =
  "bg-zinc-950 text-white hover:bg-zinc-800 active:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 dark:active:bg-zinc-200";

const btnOutlineMinimal =
  "rounded-md border-[#EAEAEA] bg-transparent shadow-none hover:bg-[#F7F6F3] dark:border-zinc-700 dark:hover:bg-zinc-800/80";

const btnSecondaryMinimal =
  "rounded-md border border-[#EAEAEA] bg-[#F7F6F3] text-[#111111] shadow-none hover:bg-[#EFEEE9] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700";

function PricingSkeleton() {
  return (
    <div className="relative mx-auto max-w-5xl" aria-busy="true" aria-label="Loading plans">
      <SkeletonBlock className="h-3 w-24" />
      <SkeletonBlock className="mt-3 h-9 w-full max-w-md" />
      <SkeletonBlock className="mt-3 h-4 w-full max-w-lg" />
      <SkeletonBlock className="mt-6 h-4 w-64 max-w-full" />
      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        <SkeletonBlock className="h-72 w-full rounded-xl" />
        <SkeletonBlock className="h-72 w-full rounded-xl" />
        <SkeletonBlock className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function CandidatePricingPage() {
  const supabase = createClient();
  const preferReducedMotion = useReducedMotion() === true;
  const [currentPlan, setCurrentPlan] = useState<CandidatePlan>("free");
  const [usage, setUsage] = useState<Record<UsageFeature, number>>({
    cv_analysis: 0,
    mock_interview: 0,
  });
  const [loading, setLoading] = useState<string | null>(null);
  const [pageReady, setPageReady] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
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
      } finally {
        setPageReady(true);
      }
    }
    void load();
  }, [supabase]);

  async function handleUpgrade(planId: CandidatePlan) {
    if (planId === "free") return;
    setCheckoutError(null);
    setLoading(planId);
    try {
      const res = await fetch("/api/candidate/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError(data.error || "Could not start checkout");
      }
    } catch {
      setCheckoutError("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  const cvLimit = PLAN_LIMITS[currentPlan].cv_analysis;
  const mockLimit = PLAN_LIMITS[currentPlan].mock_interview;
  const listParent = listParentVariants(preferReducedMotion);
  const listItem = listItemVariants(preferReducedMotion);
  const enterTransition = preferReducedMotion
    ? { duration: 0 }
    : { duration: 0.4, ease: motionEase };

  function PlanCard({ plan, className }: { plan: PlanDef; className?: string }) {
    const isCurrent = plan.id === currentPlan;
    const headingId = `plan-title-${plan.id}`;
    return (
      <motion.article
        variants={listItem}
        aria-labelledby={headingId}
        className={cn(
          "group relative flex h-full flex-col rounded-xl border border-[#EAEAEA] bg-[#FFFFFF] p-6 transition-shadow duration-200 motion-reduce:transition-none dark:border-zinc-800 dark:bg-zinc-950",
          "hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.2)]",
          plan.featured && "border-l-[3px] border-l-[#FBF3DB] dark:border-l-[#3f3a2e]",
          className
        )}
      >
        {plan.featured && (
          <span className="absolute right-5 top-5 rounded-full bg-[#FBF3DB] px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.05em] text-[#956400] dark:bg-[#2a2619] dark:text-[#d4a84b]">
            Most chosen
          </span>
        )}
        <div className={cn(plan.featured && "pr-[5.5rem]")}>
          <h3
            id={headingId}
            className="text-[15px] font-semibold tracking-tight text-[#111111] dark:text-zinc-50"
          >
            {plan.name}
          </h3>
          <p className="mt-1 text-[13px] leading-[1.6] text-[#787774] dark:text-zinc-400">{plan.blurb}</p>
        </div>
        <div className="mt-5 flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-[#111111] dark:text-zinc-50">
            {plan.price}
          </span>
          <span className="text-[13px] font-medium text-[#787774] dark:text-zinc-500">{plan.period}</span>
        </div>
        <ul className="mt-5 flex flex-1 flex-col gap-2.5 border-t border-[#EAEAEA] pt-5 dark:border-zinc-800">
          {plan.features.map((f) => (
            <li
              key={f}
              className="flex items-start gap-2 text-[13px] leading-[1.6] text-[#2F3437] dark:text-zinc-300"
            >
              <Check
                className="mt-0.5 h-4 w-4 shrink-0 text-[#346538] dark:text-[#8fb88f]"
                weight="bold"
                aria-hidden
              />
              {f}
            </li>
          ))}
        </ul>
        <div className="mt-6">
          {isCurrent ? (
            <Button variant="outline" className={cn("w-full", btnMinimal, btnOutlineMinimal)} disabled>
              Current plan
            </Button>
          ) : plan.id === "free" ? (
            <Button variant="outline" className={cn("w-full", btnMinimal, btnOutlineMinimal)} disabled>
              Free
            </Button>
          ) : (
            <Button
              variant={plan.featured ? "primary" : "secondary"}
              className={cn(
                "w-full cursor-pointer",
                btnMinimal,
                plan.featured ? btnPrimaryMinimal : btnSecondaryMinimal
              )}
              isLoading={loading === plan.id}
              onClick={() => void handleUpgrade(plan.id)}
            >
              Upgrade to {plan.name}
            </Button>
          )}
        </div>
      </motion.article>
    );
  }

  if (!pageReady) {
    return <PricingSkeleton />;
  }

  return (
    <div className="relative mx-auto max-w-5xl">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-100 dark:opacity-60"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 0% 0%, rgba(251, 243, 219, 0.35), transparent 55%), radial-gradient(ellipse 55% 40% at 100% 10%, rgba(0,0,0,0.03), transparent 50%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[#FBFBFA]/80 dark:bg-zinc-950/90" aria-hidden />

      <motion.header
        initial={preferReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={enterTransition}
        className="max-w-3xl"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#787774] dark:text-zinc-500">
          Plans
        </p>
        <h1 className="mt-3 font-serif text-[1.75rem] font-normal leading-[1.15] tracking-[-0.02em] text-[#111111] dark:text-zinc-50 sm:text-[2rem]">
          Upgrade when you need more reps
        </h1>
        <p className="mt-4 max-w-[65ch] text-[15px] leading-[1.6] text-[#787774] dark:text-zinc-400">
          Higher tiers add weekly CV reviews and mock interviews. Stay on Free for as long as it fits your pace.
        </p>
      </motion.header>

      <motion.div
        initial={preferReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...enterTransition, delay: preferReducedMotion ? 0 : 0.04 }}
        className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[#EAEAEA] pb-4 text-[13px] text-[#787774] dark:border-zinc-800 dark:text-zinc-500"
      >
        <span className="sr-only">Your subscription and this week&apos;s usage:</span>
        <span className="font-medium capitalize text-[#111111] dark:text-zinc-200">{currentPlan}</span>
        <span className="text-[#EAEAEA] dark:text-zinc-600" aria-hidden>
          ·
        </span>
        <span className="font-mono tabular-nums text-[#2F3437] dark:text-zinc-300">
          CV {usage.cv_analysis}/{cvLimit === Infinity ? "∞" : cvLimit}/wk
        </span>
        <span className="text-[#EAEAEA] dark:text-zinc-600" aria-hidden>
          ·
        </span>
        <span className="font-mono tabular-nums text-[#2F3437] dark:text-zinc-300">
          Mock {usage.mock_interview}/{mockLimit === Infinity ? "∞" : mockLimit}/wk
        </span>
      </motion.div>

      {checkoutError && (
        <div
          className="mt-4 flex flex-col gap-3 rounded-md border border-[#FDEBEC] bg-[#FDEBEC] px-3 py-3 text-[13px] leading-[1.6] text-[#9F2F2D] dark:border-red-900/40 dark:bg-red-950/35 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="min-w-0 flex-1">
            {checkoutError}{" "}
            <span className="text-[#7a2826] dark:text-red-300/90">Choose a plan below to try again.</span>
          </p>
          <button
            type="button"
            onClick={() => setCheckoutError(null)}
            className="shrink-0 cursor-pointer rounded-md border border-[#e8c5c7] bg-white/80 px-3 py-2 text-xs font-medium text-[#7a2826] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9F2F2D] focus-visible:ring-offset-2 dark:border-red-800/50 dark:bg-red-950/50 dark:text-red-100 dark:hover:bg-red-950/80 dark:focus-visible:ring-red-300 dark:focus-visible:ring-offset-zinc-950"
          >
            Dismiss
          </button>
        </div>
      )}

      <section aria-labelledby="pricing-plan-comparison">
        <h2
          id="pricing-plan-comparison"
          className="mt-10 text-xs font-semibold uppercase tracking-[0.14em] text-[#787774] dark:text-zinc-500"
        >
          Compare plans
        </h2>

        <motion.div
          variants={listParent}
          initial="hidden"
          animate="show"
          className="mt-4 grid grid-cols-1 items-stretch gap-5 md:grid-cols-3"
        >
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </motion.div>
      </section>

      <motion.p
        initial={preferReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...enterTransition, delay: preferReducedMotion ? 0 : 0.12 }}
        className="mt-10 max-w-[65ch] text-[13px] leading-[1.6] text-[#787774] dark:text-zinc-500"
      >
        Prices in USD. You can change or cancel anytime from billing after checkout.
      </motion.p>
    </div>
  );
}
