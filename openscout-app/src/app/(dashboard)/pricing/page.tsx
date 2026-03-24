"use client";

import { useState, useEffect, useMemo } from "react";
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
  "h-12 rounded-xl shadow-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-transparent";

const btnPrimaryMinimal = "bg-primary text-white hover:bg-primary-dark active:bg-primary-dark";

const btnOutlineMinimal =
  "border border-[var(--border-strong)] bg-transparent text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800";

const btnSecondaryMinimal =
  "bg-primary-lighter text-primary-dark hover:bg-primary-muted dark:bg-primary-muted dark:text-primary-dark dark:hover:bg-primary-lighter";

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
  const supabase = useMemo(() => createClient(), []);
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
          "group relative flex h-full flex-col px-6 py-9 transition-colors duration-200 motion-reduce:transition-none sm:px-8 sm:py-10",
          plan.featured &&
            "bg-gradient-to-b from-[var(--primary-muted)]/50 via-transparent to-transparent dark:from-primary/10 dark:via-transparent",
          className
        )}
      >
        {plan.featured && (
          <div
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent opacity-90"
            aria-hidden
          />
        )}
        {plan.featured && (
          <span className="absolute right-6 top-5 rounded-full bg-[var(--primary-muted)] px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.05em] text-[var(--primary-dark)]">
            Most chosen
          </span>
        )}
        <div className={cn(plan.featured && "pr-[5.5rem]")}>
          <h3
            id={headingId}
            className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            {plan.name}
          </h3>
          <p className="mt-1 text-xs leading-[1.6] text-zinc-700 dark:text-zinc-300">{plan.blurb}</p>
        </div>
        <div className="mt-8 flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
            {plan.price}
          </span>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{plan.period}</span>
        </div>
        <ul className="mt-8 flex flex-1 flex-col gap-2.5 border-t border-[var(--border)] pt-8 dark:border-white/[0.06]">
          {plan.features.map((f) => (
            <li key={f} className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">
              <Check className="mr-2 inline-block h-3.5 w-3.5 text-[var(--primary)] align-middle opacity-85" weight="bold" aria-hidden />
              {f}
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-1 flex-col justify-end">
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
    <div className="mx-auto max-w-5xl">

      <motion.header
        initial={preferReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={enterTransition}
        className="max-w-3xl"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#787774] dark:text-zinc-500">
          Upgrade
        </p>
        <h1 className="mt-3 font-serif text-[1.75rem] font-normal leading-[1.15] tracking-[-0.02em] text-[#111111] dark:text-zinc-50 sm:text-[2rem]">
          Upgrade
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

        <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-white/75 bg-white/60 shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur-xl ring-1 ring-black/[0.04] dark:border-white/[0.08] dark:bg-black/45 dark:backdrop-blur-xl dark:ring-white/[0.03]">
          <motion.div
            variants={listParent}
            initial="hidden"
            animate="show"
            className="grid divide-y divide-[var(--border)] dark:divide-white/[0.08] md:grid-cols-3 md:divide-x md:divide-y-0"
          >
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </motion.div>
        </div>
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
