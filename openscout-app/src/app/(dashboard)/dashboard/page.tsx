"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  ArrowRight,
  Briefcase,
  ChatCircle,
  CreditCard,
  FileText,
} from "@phosphor-icons/react";
import { CardInteractive } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { InviteFriendCard } from "@/components/dashboard/InviteFriendCard";
import { NextStepCard } from "@/components/dashboard/NextStepCard";
import { SharePublicProfileButton } from "@/components/dashboard/SharePublicProfileButton";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserPlan, PLAN_LIMITS, type CandidatePlan } from "@/lib/usage";
import { applyPendingCandidateProfileIfAny } from "@/lib/apply-pending-registration-profile";
import {
  buildJourneySignals,
  deriveDashboardNextStep,
  type NextStepCardModel,
} from "@/lib/next-step-guidance";

const PENDING_EMPLOYER_KEY = "pending_employer_company";

/** Stitch / design-system default: spring, not linear. */
const staggerSpring = { type: "spring" as const, stiffness: 100, damping: 20 };

function staggerVariants(reduceMotion: boolean | null) {
  if (reduceMotion) {
    return {
      parent: { hidden: {}, show: { transition: { staggerChildren: 0 } } },
      item: { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0, transition: { duration: 0 } } },
    };
  }
  return {
    parent: {
      hidden: {},
      show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
    },
    item: {
      hidden: { opacity: 0, y: 12 },
      show: { opacity: 1, y: 0, transition: staggerSpring },
    },
  };
}

const focusRingTile =
  "block h-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F6F3] dark:focus-visible:ring-primary dark:focus-visible:ring-offset-zinc-950";

function DashboardLoadingSkeleton() {
  const bar =
    "rounded-md bg-[#E8E6E3] motion-reduce:animate-none dark:bg-zinc-800/90";
  return (
    <div className="relative z-10 mx-auto max-w-7xl space-y-16 pb-16 lg:space-y-24 lg:pb-24" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="max-w-2xl space-y-5 lg:col-span-7">
          <div className={`h-12 w-48 ${bar}`} />
          <div className={`h-4 max-w-[min(65ch,100%)] ${bar}`} />
          <div className={`h-4 max-w-md ${bar} w-[80%]`} />
          <div className={`mt-8 h-11 w-44 rounded-md ${bar}`} />
        </div>
        <div
          className={`h-40 rounded-lg border border-[#EAEAEA] motion-reduce:animate-none dark:border-white/[0.08] ${bar} animate-pulse`}
        />
      </div>
      <div
        className={`h-24 rounded-lg border border-[#EAEAEA] motion-reduce:animate-none dark:border-white/[0.08] ${bar} animate-pulse`}
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
        <div className={`h-44 rounded-lg border border-[#EAEAEA] motion-reduce:animate-none dark:border-white/[0.08] sm:col-span-2 lg:col-span-5 ${bar} animate-pulse`} />
        <div className={`h-44 rounded-lg border border-[#EAEAEA] motion-reduce:animate-none dark:border-white/[0.08] sm:col-span-2 lg:col-span-7 ${bar} animate-pulse`} />
        <div className={`h-44 rounded-lg border border-[#EAEAEA] motion-reduce:animate-none dark:border-white/[0.08] lg:col-span-6 ${bar} animate-pulse`} />
        <div className={`h-44 rounded-lg border border-[#EAEAEA] motion-reduce:animate-none dark:border-white/[0.08] lg:col-span-6 ${bar} animate-pulse`} />
        <div className={`h-36 rounded-lg border border-[#EAEAEA] motion-reduce:animate-none dark:border-white/[0.08] lg:col-span-12 ${bar} animate-pulse`} />
        <div className={`h-52 rounded-lg border border-[#EAEAEA] motion-reduce:animate-none dark:border-white/[0.08] lg:col-span-12 ${bar} animate-pulse`} />
      </div>
    </div>
  );
}

function ActionTile({
  href,
  icon: Icon,
  title,
  description,
  cta,
  className,
}: {
  href: string;
  icon: PhosphorIcon;
  title: string;
  description: string;
  cta: string;
  className?: string;
}) {
  return (
    <Link href={href} className={className}>
      <CardInteractive flat className="group h-full p-8 lg:p-10">
        <div className="flex h-full flex-col">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg border border-[#EAEAEA] bg-[#FBF3DB] dark:border-[#3d3520] dark:bg-[#2a2618]">
            <Icon className="h-6 w-6 text-[#956400] dark:text-[#E8D4A8]" weight="bold" aria-hidden />
          </div>
          <h3 className="text-base font-medium tracking-tight text-[#111111] dark:text-[#FAFAFA]">{title}</h3>
          <p className="mt-3 text-sm leading-[1.6] text-[#787774] dark:text-[#A09C98]">{description}</p>
          <div className="mt-auto flex items-center gap-1.5 pt-8 text-sm font-medium text-[#111111] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0 dark:text-[#FAFAFA]">
            {cta}
            <ArrowRight className="h-4 w-4" weight="bold" aria-hidden />
          </div>
        </div>
      </CardInteractive>
    </Link>
  );
}

export default function DashboardPage() {
  const reduceMotion = useReducedMotion();
  const { parent: staggerParent, item: staggerItem } = staggerVariants(reduceMotion);
  const router = useRouter();
  const [plan, setPlan] = useState<CandidatePlan>("free");
  const [cvUsed, setCvUsed] = useState(0);
  const [mockUsed, setMockUsed] = useState(0);
  const [mockBonusCredits, setMockBonusCredits] = useState(0);
  const [checkedEmployer, setCheckedEmployer] = useState(false);
  const [nextStep, setNextStep] = useState<NextStepCardModel | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?redirect=" + encodeURIComponent("/dashboard"));
        return;
      }

      let pendingEmployer = false;
      try {
        pendingEmployer = !!sessionStorage.getItem(PENDING_EMPLOYER_KEY);
      } catch {
        /* ignore */
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      const isEmployer =
        profile?.role === "employer" || company != null || pendingEmployer;
      if (isEmployer) {
        router.replace("/employer");
        return;
      }
      try {
        await applyPendingCandidateProfileIfAny(supabase, user.id, user.email ?? undefined);
      } catch {
        /* ignore */
      }
      setCheckedEmployer(true);
    }
    load();
  }, [supabase, router]);

  useEffect(() => {
    if (!checkedEmployer) return;
    async function loadPlan() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?redirect=" + encodeURIComponent("/dashboard"));
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, bonus_mock_interview_credits")
        .eq("user_id", user.id)
        .maybeSingle();
      const p = getUserPlan(profile?.plan);
      setPlan(p);
      setMockBonusCredits(
        Math.max(
          0,
          Number(
            (profile as { bonus_mock_interview_credits?: number } | null)?.bonus_mock_interview_credits
          ) || 0
        )
      );

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { count: cv } = await supabase
        .from("usage_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("feature", "cv_analysis")
        .gte("created_at", weekAgo.toISOString());
      const { count: mock } = await supabase
        .from("usage_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("feature", "mock_interview")
        .gte("created_at", weekAgo.toISOString());
      setCvUsed(cv ?? 0);
      setMockUsed(mock ?? 0);
    }
    loadPlan();
  }, [supabase, checkedEmployer, router]);

  useEffect(() => {
    if (!checkedEmployer) return;
    async function loadJourney() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?redirect=" + encodeURIComponent("/dashboard"));
        return;
      }
      const [profileRes, privRes, cvRes, miRes, jaRes] = await Promise.all([
        supabase.from("profiles").select("onboarding_completed_at").eq("user_id", user.id).maybeSingle(),
        supabase.from("profile_private").select("cv_file_url, cv_raw_text").eq("user_id", user.id).maybeSingle(),
        supabase.from("cv_analyses").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
        supabase.from("mock_interviews").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
        supabase.from("job_applications").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
      ]);
      const priv = privRes.data as { cv_file_url?: string | null; cv_raw_text?: string | null } | null;
      const signals = buildJourneySignals({
        onboardingCompletedAt: (profileRes.data as { onboarding_completed_at?: string | null } | null)
          ?.onboarding_completed_at,
        cvFileUrl: priv?.cv_file_url,
        cvRawText: priv?.cv_raw_text,
        cvAnalysisRowExists: cvRes.data != null,
        mockInterviewRowExists: miRes.data != null,
        jobApplicationRowExists: jaRes.data != null,
      });
      setNextStep(deriveDashboardNextStep(signals));
    }
    loadJourney();
  }, [supabase, checkedEmployer, router]);

  const cvLimit = PLAN_LIMITS[plan].cv_analysis;
  const mockLimit = PLAN_LIMITS[plan].mock_interview;

  if (!checkedEmployer) {
    return <DashboardLoadingSkeleton />;
  }

  return (
    <div className="relative z-10 mx-auto max-w-7xl pb-20 lg:pb-28">
      <a
        href="#dashboard-quick-actions"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-[#EAEAEA] focus:bg-[#FFFFFF] focus:px-4 focus:py-2 focus:text-sm focus:text-[#111111] focus:shadow-none dark:focus:border-white/20 dark:focus:bg-[#141414] dark:focus:text-[#FAFAFA]"
      >
        Skip to quick actions
      </a>
      <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-20">
        <header className="max-w-2xl lg:col-span-7 lg:pt-1">
          <h1
            id="dashboard-home-heading"
            className="text-3xl font-semibold leading-tight tracking-tight text-zinc-950 md:text-4xl dark:text-zinc-50"
          >
            Home
          </h1>
          <p className="mt-6 max-w-xl text-base leading-[1.6] text-[#787774] dark:text-[#A09C98]">
            Finish <span className="font-medium text-[#111111] dark:text-[#FAFAFA]">My profile</span>, run a CV check,
            then practice interviews. Sharing a public profile is optional and stays under your control.
          </p>
          <div className="mt-8">
            <SharePublicProfileButton size="md" minimal />
          </div>
        </header>

        <aside className="lg:col-span-5" aria-label="Plan and weekly usage summary">
          <div className="rounded-lg border border-[#EAEAEA] bg-[#FFFFFF] p-8 shadow-none dark:border-white/[0.08] dark:bg-[#141414]">
            <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-[#A09C98]">
              Plan and weekly usage
            </p>
            <div className="mt-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span
                  className={cn(
                    "inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.05em]",
                    plan === "free"
                      ? "bg-[#FBF3DB] text-[#956400] dark:bg-[#3d3520] dark:text-[#E8D4A8]"
                      : "bg-[#EDF3EC] text-[#346538] dark:bg-[#1e2a1f] dark:text-[#B4D4B8]"
                  )}
                >
                  {plan}
                </span>
                {plan === "free" && (
                  <Link
                    href="/pricing"
                    className={cn(
                      "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-[#EAEAEA] bg-transparent px-4 text-sm font-medium text-[#111111] outline-none transition-colors hover:bg-[#F7F6F3] focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFFFF] active:scale-[0.98] dark:border-white/[0.12] dark:text-[#FAFAFA] dark:hover:bg-white/[0.06] dark:focus-visible:ring-neutral-200 dark:focus-visible:ring-offset-[#141414]"
                    )}
                  >
                    <CreditCard className="h-4 w-4 shrink-0" weight="bold" aria-hidden />
                    Upgrade
                  </Link>
                )}
              </div>
              <dl className="grid gap-5 text-sm leading-[1.6] text-[#787774] dark:text-[#A09C98]">
                <div className="flex justify-between gap-4">
                  <dt>CV analysis</dt>
                  <dd className="font-mono tabular-nums text-[#111111] dark:text-[#FAFAFA]">
                    <span className="sr-only">Used this week out of weekly limit. </span>
                    {cvUsed}/{cvLimit === Infinity ? "∞" : cvLimit}
                    <span className="ml-1.5 font-sans text-xs font-normal text-[#787774] dark:text-[#A09C98]">
                      this week
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Mock interview</dt>
                  <dd className="font-mono tabular-nums text-[#111111] dark:text-[#FAFAFA]">
                    <span className="sr-only">Used this week out of weekly limit. </span>
                    {mockUsed}/{mockLimit === Infinity ? "∞" : mockLimit}
                    <span className="ml-1.5 font-sans text-xs font-normal text-[#787774] dark:text-[#A09C98]">
                      this week
                    </span>
                  </dd>
                </div>
                {mockBonusCredits > 0 && (
                  <div className="flex justify-between gap-4">
                    <dt>Bonus credits</dt>
                    <dd className="font-mono tabular-nums text-[#111111] dark:text-[#FAFAFA]">{mockBonusCredits}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </aside>
      </div>

      {nextStep && (
        <div className="mt-20 lg:mt-28">
          <NextStepCard step={nextStep} />
        </div>
      )}

      <section
        id="dashboard-quick-actions"
        className="mt-20 lg:mt-28"
        aria-labelledby="dashboard-quick-actions-heading"
      >
        <h2 id="dashboard-quick-actions-heading" className="sr-only">
          Quick actions
        </h2>
        <motion.div
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8"
          variants={staggerParent}
          initial="hidden"
          animate="show"
        >
        <motion.div variants={staggerItem} className="sm:col-span-2 lg:col-span-5">
          <ActionTile
            href="/onboarding"
            icon={FileText}
            title="My profile"
            description="Keep your story, preferences, and links current in one structured flow."
            cta="Open profile"
          />
        </motion.div>
        <motion.div variants={staggerItem} className="sm:col-span-2 lg:col-span-7">
          <ActionTile
            href="/cv-analysis"
            icon={FileText}
            title="CV analysis"
            description="Upload a CV and get structured feedback aligned with how hiring teams read applications."
            cta="Analyze CV"
          />
        </motion.div>
        <motion.div variants={staggerItem} className="sm:col-span-2 lg:col-span-6">
          <ActionTile
            href="/mock-interview"
            icon={ChatCircle}
            title="Mock interview"
            description="Run a timed practice session with AI prompts and a clear rubric."
            cta="Start session"
          />
        </motion.div>
        <motion.div variants={staggerItem} className="sm:col-span-2 lg:col-span-6">
          <Link
            href="/dashboard/jobs"
            className={cn(focusRingTile)}
            aria-label="Job listings: browse open roles and apply"
          >
            <CardInteractive
              flat
              className="group flex h-full flex-col p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:p-10"
            >
              <div className="flex flex-1 items-start gap-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#EAEAEA] bg-[#E1F3FE] dark:border-[#1a3a52] dark:bg-[#0f2433]">
                  <Briefcase className="h-6 w-6 text-[#1F6C9F] dark:text-[#7EC8F5]" weight="bold" aria-hidden />
                </div>
                <div>
                  <h3 className="text-base font-medium tracking-tight text-[#111111] dark:text-[#FAFAFA]">
                    Job listings
                  </h3>
                  <p className="mt-3 max-w-md text-sm leading-[1.6] text-[#787774] dark:text-[#A09C98]">
                    Read posts, then apply from the same place so nothing gets lost between tabs.
                  </p>
                </div>
              </div>
              <div className="mt-8 flex shrink-0 lg:mt-0">
                <span
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-transparent bg-[#111111] px-5 text-sm font-medium text-white transition-colors duration-200 ease-out group-hover:bg-[#333333] motion-reduce:transition-none dark:bg-neutral-100 dark:text-neutral-950 dark:group-hover:bg-neutral-200"
                  aria-hidden
                >
                  View listings
                </span>
              </div>
            </CardInteractive>
          </Link>
        </motion.div>
        <motion.div variants={staggerItem} className="sm:col-span-2 lg:col-span-12">
          <InviteFriendCard />
        </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
