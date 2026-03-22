"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  ChatCircle,
  CreditCard,
  FileText,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { Newsreader } from "next/font/google";
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

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600"],
});

const PENDING_EMPLOYER_KEY = "pending_employer_company";

/** Minimalist-ui: cubic-bezier(0.16, 1, 0.3, 1), 600ms, translateY 12px via Framer whileInView (IntersectionObserver). */
const editorialEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

const revealTransition = (delay = 0) => ({
  duration: 0.6,
  ease: editorialEase,
  delay,
});

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-64px" }}
      transition={revealTransition(delay)}
    >
      {children}
    </motion.div>
  );
}

const bentoCard =
  "group flex h-full flex-col border border-[#EAEAEA] bg-white p-8 transition-[box-shadow,transform] duration-200 dark:border-zinc-800 dark:bg-[#141312] rounded-xl hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.99] dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.2)]";

const planPanel =
  "rounded-xl border border-[#EAEAEA] bg-white p-8 dark:border-zinc-800 dark:bg-[#141312]";

const iconWellBase =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg";

const iconWell = `${iconWellBase} mb-5`;

function DashboardLoadingSkeleton() {
  return (
    <div className="-mx-4 min-h-full bg-[#F7F6F3] px-4 py-12 lg:-mx-8 lg:px-8 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-5xl space-y-16">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-start">
          <div className="space-y-4 lg:col-span-7">
            <div className="h-10 w-2/3 max-w-sm animate-pulse rounded-lg bg-[#EAEAEA]/80 dark:bg-zinc-800" />
            <div className="h-4 w-full max-w-xl animate-pulse rounded bg-[#EAEAEA]/60 dark:bg-zinc-800/80" />
            <div className="h-4 w-4/5 max-w-lg animate-pulse rounded bg-[#EAEAEA]/60 dark:bg-zinc-800/80" />
            <div className="h-9 w-44 animate-pulse rounded-md bg-[#EAEAEA]/60 dark:bg-zinc-800/80" />
          </div>
          <div className="h-48 animate-pulse rounded-xl border border-[#EAEAEA] bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-5" />
        </div>
        <div className="h-32 animate-pulse rounded-xl border border-[#EAEAEA] bg-white dark:border-zinc-800 dark:bg-zinc-900" />
        <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
          <div className="space-y-6">
            <div className="h-44 animate-pulse rounded-xl border border-[#EAEAEA] bg-white dark:border-zinc-800 dark:bg-zinc-900" />
            <div className="h-44 animate-pulse rounded-xl border border-[#EAEAEA] bg-white dark:border-zinc-800 dark:bg-zinc-900" />
          </div>
          <div className="min-h-[220px] animate-pulse rounded-xl border border-[#EAEAEA] bg-white dark:border-zinc-800 dark:bg-zinc-900" />
        </div>
        <div className="h-52 animate-pulse rounded-xl border border-[#EAEAEA] bg-white dark:border-zinc-800 dark:bg-zinc-900" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
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
      if (!user) return;

      let pendingEmployer = false;
      try {
        pendingEmployer = !!sessionStorage.getItem(PENDING_EMPLOYER_KEY);
      } catch {}
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
        await applyPendingCandidateProfileIfAny(
          supabase,
          user.id,
          user.email ?? undefined
        );
      } catch (_) {}
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
      if (!user) return;
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
            (profile as { bonus_mock_interview_credits?: number } | null)
              ?.bonus_mock_interview_credits
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
  }, [supabase, checkedEmployer]);

  useEffect(() => {
    if (!checkedEmployer) return;
    async function loadJourney() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const [profileRes, privRes, cvRes, miRes, jaRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("onboarding_completed_at")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("profile_private")
          .select("cv_file_url, cv_raw_text")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("cv_analyses")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("mock_interviews")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("job_applications")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle(),
      ]);
      const priv = privRes.data as {
        cv_file_url?: string | null;
        cv_raw_text?: string | null;
      } | null;
      const signals = buildJourneySignals({
        onboardingCompletedAt: (
          profileRes.data as {
            onboarding_completed_at?: string | null;
          } | null
        )?.onboarding_completed_at,
        cvFileUrl: priv?.cv_file_url,
        cvRawText: priv?.cv_raw_text,
        cvAnalysisRowExists: cvRes.data != null,
        mockInterviewRowExists: miRes.data != null,
        jobApplicationRowExists: jaRes.data != null,
      });
      setNextStep(deriveDashboardNextStep(signals));
    }
    loadJourney();
  }, [supabase, checkedEmployer]);

  const cvLimit = PLAN_LIMITS[plan].cv_analysis;
  const mockLimit = PLAN_LIMITS[plan].mock_interview;

  if (!checkedEmployer) {
    return <DashboardLoadingSkeleton />;
  }

  return (
    <div className="relative -mx-4 min-h-full overflow-x-clip bg-[#F7F6F3] px-4 pb-24 pt-10 lg:-mx-8 lg:px-8 dark:bg-zinc-950">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[#F7F6F3] [background-image:radial-gradient(ellipse_90%_60%_at_50%_-30%,rgba(251,243,219,0.38),transparent_58%)] dark:bg-zinc-950 dark:[background-image:radial-gradient(ellipse_75%_50%_at_50%_-20%,rgba(253,235,236,0.06),transparent_55%)]"
      />

      <div className="relative mx-auto w-full max-w-5xl">
        <Reveal>
          <div className="grid gap-12 lg:grid-cols-12 lg:items-start lg:gap-14">
            <header className="lg:col-span-7">
              <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-zinc-500">
                Candidate home
              </p>
              <h1
                className={`mt-4 text-[2.25rem] font-semibold leading-[1.1] tracking-[-0.03em] text-[#111111] md:text-5xl dark:text-zinc-100 ${newsreader.className}`}
              >
                Welcome back
              </h1>
              <p className="mt-6 max-w-xl text-base leading-[1.6] text-[#787774] dark:text-zinc-400">
                Open{" "}
                <span className="font-medium text-[#111111] dark:text-zinc-200">
                  My profile
                </span>{" "}
                to finish setup, then run CV analysis and mock interviews when
                you are ready.
              </p>
              <div className="mt-8">
                <SharePublicProfileButton />
              </div>
            </header>

            <aside className="lg:col-span-5">
              <div className={planPanel}>
                <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-zinc-500">
                  Plan and weekly usage
                </p>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-lg font-semibold capitalize text-[#111111] dark:text-zinc-100">
                    {plan}
                  </span>
                  <span className="text-sm text-[#787774] dark:text-zinc-500">
                    plan
                  </span>
                </div>
                <dl className="mt-6 space-y-3 border-t border-[#EAEAEA] pt-6 text-sm dark:border-zinc-800">
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#787774] dark:text-zinc-500">
                      CV analysis
                    </dt>
                    <dd className="font-mono tabular-nums text-[#111111] dark:text-zinc-100">
                      {cvUsed}/{cvLimit === Infinity ? "∞" : cvLimit}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#787774] dark:text-zinc-500">
                      Mock interview
                    </dt>
                    <dd className="font-mono tabular-nums text-[#111111] dark:text-zinc-100">
                      {mockUsed}/{mockLimit === Infinity ? "∞" : mockLimit}
                    </dd>
                  </div>
                  <div className="text-xs leading-relaxed text-[#787774] dark:text-zinc-500">
                    Counts use a rolling 7-day window.
                  </div>
                  {mockBonusCredits > 0 && (
                    <div className="text-xs leading-relaxed text-[#787774] dark:text-zinc-400">
                      {mockBonusCredits} bonus interview credit
                      {mockBonusCredits !== 1 ? "s" : ""} available.
                    </div>
                  )}
                </dl>
                {plan === "free" && (
                  <div className="mt-8">
                    <Link
                      href="/pricing"
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-[#EAEAEA] bg-white px-4 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F9F9F8] active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <CreditCard className="h-4 w-4" weight="bold" aria-hidden />
                      Upgrade
                    </Link>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </Reveal>

        {nextStep && (
          <Reveal className="mt-20" delay={0.08}>
            <NextStepCard step={nextStep} />
          </Reveal>
        )}

        <Reveal className="mt-20" delay={0.04}>
          <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
            <div className="flex flex-col gap-6">
              <Link href="/onboarding" className="block h-full">
                <div className={bentoCard}>
                  <div
                    className={`${iconWell} bg-[#FBF3DB] text-[#956400]`}
                  >
                    <FileText className="h-6 w-6" weight="bold" aria-hidden />
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight text-[#111111] dark:text-zinc-100">
                    My profile
                  </h2>
                  <p className="mt-2 flex-1 text-sm leading-[1.6] text-[#787774] dark:text-zinc-400">
                    Finish or update your details in one place.
                  </p>
                  <div className="mt-6 flex items-center text-sm font-medium text-[#111111] dark:text-zinc-200">
                    Continue
                    <ArrowRight
                      className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5"
                      weight="bold"
                      aria-hidden
                    />
                  </div>
                </div>
              </Link>

              <Link href="/cv-analysis" className="block h-full">
                <div className={bentoCard}>
                  <div
                    className={`${iconWell} bg-[#E1F3FE] text-[#1F6C9F]`}
                  >
                    <FileText className="h-6 w-6" weight="bold" aria-hidden />
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight text-[#111111] dark:text-zinc-100">
                    CV analysis
                  </h2>
                  <p className="mt-2 flex-1 text-sm leading-[1.6] text-[#787774] dark:text-zinc-400">
                    Upload a CV and get structured feedback against open roles.
                  </p>
                  <div className="mt-6 flex items-center text-sm font-medium text-[#111111] dark:text-zinc-200">
                    Open tool
                    <ArrowRight
                      className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5"
                      weight="bold"
                      aria-hidden
                    />
                  </div>
                </div>
              </Link>
            </div>

            <Link href="/mock-interview" className="block min-h-0">
              <div className={`${bentoCard} min-h-[280px] lg:min-h-full lg:py-10`}>
                <div
                  className={`${iconWell} bg-[#EDF3EC] text-[#346538]`}
                >
                  <ChatCircle className="h-6 w-6" weight="bold" aria-hidden />
                </div>
                <h2 className="text-lg font-semibold tracking-tight text-[#111111] dark:text-zinc-100">
                  Mock interview
                </h2>
                <p className="mt-2 flex-1 text-base leading-[1.6] text-[#787774] dark:text-zinc-400">
                  Run a structured AI session and read a short scorecard when
                  you finish.
                </p>
                <div className="mt-8 flex items-center text-sm font-medium text-[#111111] dark:text-zinc-200">
                  Start session
                  <ArrowRight
                    className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    weight="bold"
                    aria-hidden
                  />
                </div>
              </div>
            </Link>
          </div>
        </Reveal>

        <Reveal className="mt-6" delay={0.08}>
          <Link href="/dashboard/jobs" className="block">
            <div className={bentoCard}>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                  <div
                    className={`${iconWellBase} bg-[#FDEBEC] text-[#9F2F2D]`}
                  >
                    <Briefcase className="h-6 w-6" weight="bold" aria-hidden />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-[#111111] dark:text-zinc-100">
                      Job listings
                    </h2>
                    <p className="mt-1 text-sm leading-[1.6] text-[#787774] dark:text-zinc-400">
                      Browse open roles and track applications from here.
                    </p>
                  </div>
                </div>
                <span className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-[#111111] px-4 text-sm font-medium text-white transition-colors hover:bg-[#333333] active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white">
                  View listings
                </span>
              </div>
            </div>
          </Link>
        </Reveal>

        <Reveal className="mt-6" delay={0.1}>
          <InviteFriendCard />
        </Reveal>
      </div>
    </div>
  );
}
