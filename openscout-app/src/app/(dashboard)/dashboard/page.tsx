"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Newsreader } from "next/font/google";
import { motion } from "framer-motion";
import { CandidateApplicationStatusBadge } from "@/components/candidate/CandidateApplicationStatusBadge";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import {
  AnimatedDialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/Dialog";
import { SocialCardSharePanel } from "@/components/share/SocialCardSharePanel";
import { CvAnalysisCard, InterviewResultCard } from "@/components/share/SocialCards";
import { createClient } from "@/lib/supabase/client";
import { getUserPlan, type CandidatePlan } from "@/lib/usage";
import { applyPendingCandidateProfileIfAny } from "@/lib/apply-pending-registration-profile";
import { parseInterviewLocale, type InterviewLocale } from "@/lib/interview-locale";

const PENDING_EMPLOYER_KEY = "pending_employer_company";

const dashboardSerif = Newsreader({
  subsets: ["latin"],
  display: "swap",
});

/** Minimalist UI: in-view reveal — transform + opacity, calm easing. */
const revealTransition = (delay = 0) => ({
  duration: 0.6,
  delay,
  ease: [0.16, 1, 0.3, 1] as const,
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

type CvResultRow = {
  id: string;
  created_at: string;
  job_category: string | null;
  overall_score: number | null;
  strengths: unknown;
  improvements: unknown;
};

type MockResultRow = {
  id: string;
  created_at: string;
  job_category: string | null;
  score: number | null;
  interview_language: string | null;
};

type ApplicationRow = {
  id: string;
  created_at: string;
  application_status: string | null;
  job_listings: { title?: string | null } | { title?: string | null }[] | null;
};

type ScoutCardPreview =
  | {
      type: "cv";
      role: string;
      score: number;
      insight: string;
    }
  | {
      type: "interview";
      role: string;
      score: number;
      insight: string;
    };

function DashboardLoadingSkeleton() {
  return (
    <div className="-mx-4 min-h-full bg-transparent px-4 py-16 lg:-mx-8 lg:px-8 dark:bg-transparent">
      <div className="mx-auto w-full max-w-5xl space-y-20 md:space-y-24">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-start lg:gap-12">
          <div className="space-y-4 lg:col-span-7">
            <div className="h-10 w-2/3 max-w-sm animate-pulse rounded-[10px] bg-zinc-900/[0.06] dark:bg-zinc-800" />
            <div className="h-4 w-full max-w-xl animate-pulse rounded bg-zinc-900/[0.05] dark:bg-zinc-800/80" />
            <div className="h-4 w-4/5 max-w-lg animate-pulse rounded bg-zinc-900/[0.05] dark:bg-zinc-800/80" />
            <div className="h-9 w-44 animate-pulse rounded-[10px] bg-zinc-900/[0.05] dark:bg-zinc-800/80" />
          </div>
          <div className="h-48 animate-pulse rounded-[12px] border border-zinc-200/90 bg-[#FDFDFC] dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-5" />
        </div>
        <div className="h-32 animate-pulse rounded-[12px] border border-zinc-200/90 bg-[#FDFDFC] dark:border-zinc-800 dark:bg-zinc-900" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.06fr)] lg:items-stretch lg:gap-8">
          <div className="space-y-6">
            <div className="h-44 animate-pulse rounded-[12px] border border-zinc-200/90 bg-[#FDFDFC] dark:border-zinc-800 dark:bg-zinc-900" />
            <div className="h-44 animate-pulse rounded-[12px] border border-zinc-200/90 bg-[#FDFDFC] dark:border-zinc-800 dark:bg-zinc-900" />
          </div>
          <div className="min-h-[220px] animate-pulse rounded-[12px] border border-zinc-200/90 bg-[#FDFDFC] dark:border-zinc-800 dark:bg-zinc-900" />
        </div>
        <div className="h-52 animate-pulse rounded-[12px] border border-zinc-200/90 bg-[#FDFDFC] dark:border-zinc-800 dark:bg-zinc-900" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [plan, setPlan] = useState<CandidatePlan>("free");
  const [selectedTab, setSelectedTab] = useState<"cv" | "interviews" | "applications">("cv");
  const [cvResults, setCvResults] = useState<CvResultRow[]>([]);
  const [mockResults, setMockResults] = useState<MockResultRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [scoutCardPreview, setScoutCardPreview] = useState<ScoutCardPreview | null>(null);
  const [checkedEmployer, setCheckedEmployer] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cancelled = false;

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
        .select("role, first_name, plan")
        .eq("user_id", user.id)
        .maybeSingle();
      const profileData = profile as { role?: string; first_name?: string | null } | null;
      if (!cancelled) {
        setFirstName(profileData?.first_name?.trim() ?? "");
      }
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      const isEmployer =
        profileData?.role === "employer" || company != null || pendingEmployer;
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
      } catch {}

      const [cvRes, mockRes, appsRes] = await Promise.all([
        supabase
          .from("cv_analyses")
          .select("id, created_at, job_category, overall_score, strengths, improvements")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("mock_interviews")
          .select("id, created_at, job_category, score, interview_language")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("job_applications")
          .select(
            `
            id,
            created_at,
            application_status,
            job_listings ( title )
          `
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      if (cancelled) return;
      setPlan(getUserPlan((profile as { plan?: string | null } | null)?.plan));
      setCvResults(((cvRes.data ?? []) as CvResultRow[]).filter((row) => !!row?.id));
      setMockResults(((mockRes.data ?? []) as MockResultRow[]).filter((row) => !!row?.id));
      setApplications(((appsRes.data ?? []) as ApplicationRow[]).filter((row) => !!row?.id));
      setCheckedEmployer(true);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, router]);

  if (!checkedEmployer) {
    return <DashboardLoadingSkeleton />;
  }

  return (
    <div className="relative -mx-4 min-h-full overflow-x-clip bg-transparent px-4 pb-32 pt-16 lg:-mx-8 lg:px-8 dark:bg-transparent">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-transparent" />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-24 md:gap-28">
        <Reveal>
          <div className="grid gap-10">
            <header>
              <p className="text-xs font-semibold uppercase tracking-[0.05em] text-zinc-900/65 dark:text-zinc-500">
                Candidate home
              </p>
              <h1
                className={`${dashboardSerif.className} mt-3 text-[2.25rem] font-semibold leading-[1.15] tracking-[-0.02em] text-zinc-900 md:text-[2.875rem] dark:text-zinc-100`}
              >
                Welcome, {firstName || "there"}
                {plan !== "free" && (
                  <span className="ml-3 inline-flex items-center rounded-full border border-zinc-400/70 bg-gradient-to-b from-[#D4D7DE] via-[#AEB3BC] to-[#8C919A] px-2.5 py-0.5 align-middle text-xs font-semibold uppercase tracking-[0.05em] text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:border-zinc-500 dark:from-[#A3A8B0] dark:via-[#7E838C] dark:to-[#656A72] dark:text-zinc-100">
                    Pro
                  </span>
                )}
              </h1>
              <p className="mt-6 max-w-[65ch] text-base font-normal leading-[1.5] text-zinc-900/72 dark:text-zinc-400">
                Your latest outcomes across CV analysis, interviews, and applications.
              </p>
            </header>
          </div>
        </Reveal>

        <Reveal delay={0.04}>
          <section className="space-y-6">
            <div className="flex justify-center">
              <div className="relative inline-grid grid-cols-3 rounded-[10px] border border-zinc-200/90 bg-[#F5F4F2] p-1 dark:border-zinc-700 dark:bg-zinc-900">
                <motion.span
                  layoutId="dashboard-segmented-pill"
                  className={`absolute top-1 bottom-1 rounded-[8px] bg-[var(--primary)] shadow-[0_6px_18px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_20px_rgba(0,0,0,0.35)] ${
                    selectedTab === "cv"
                      ? "left-1 right-[calc(66.666%-0.25rem)]"
                      : selectedTab === "interviews"
                        ? "left-[calc(33.333%+0.125rem)] right-[calc(33.333%+0.125rem)]"
                        : "left-[calc(66.666%-0.25rem)] right-1"
                  }`}
                  transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.5 }}
                  aria-hidden
                />
                <button
                  type="button"
                  onClick={() => setSelectedTab("cv")}
                  className={`relative z-10 rounded-[8px] px-4 py-2 text-sm font-semibold transition-colors ${
                    selectedTab === "cv"
                      ? "text-white"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  CV Analysis
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTab("interviews")}
                  className={`relative z-10 rounded-[8px] px-4 py-2 text-sm font-semibold transition-colors ${
                    selectedTab === "interviews"
                      ? "text-white"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  Mock Interviews
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTab("applications")}
                  className={`relative z-10 rounded-[8px] px-4 py-2 text-sm font-semibold transition-colors ${
                    selectedTab === "applications"
                      ? "text-white"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  Applications
                </button>
              </div>
            </div>

            <div className="os-surface-card p-6 md:p-7">
              {selectedTab === "cv" && (
                <>
                  {cvResults.length === 0 ? (
                    <div className="flex min-h-[180px] flex-col items-center justify-center gap-4 text-center">
                      <p className="text-sm text-zinc-900/72 dark:text-zinc-400">No CV analysis yet</p>
                      <Link
                        href="/cv-analysis"
                        className="inline-flex h-8 items-center rounded-[10px] border border-zinc-200/90 bg-[#F5F4F2] px-3 text-sm font-semibold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        New CV analysis
                      </Link>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {cvResults.map((row) => {
                        const strengths = Array.isArray(row.strengths)
                          ? row.strengths.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
                          : [];
                        const improvements = Array.isArray(row.improvements)
                          ? row.improvements.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
                          : [];
                        const shortSummary = strengths[0] || improvements[0] || "Analysis available.";
                        return (
                          <li key={row.id}>
                            <div className="group rounded-[10px] border border-zinc-200/80 bg-[#FDFDFC] px-4 py-3 transition-colors duration-200 hover:bg-[#FAFAF8] dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:bg-zinc-900">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <Link href={`/dashboard/cv-analysis/${row.id}`} className="block min-w-0">
                                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                      {row.job_category?.trim() || "General"}
                                    </p>
                                    <p className="mt-1 line-clamp-1 text-sm text-zinc-900/72 dark:text-zinc-400">
                                      {shortSummary}
                                    </p>
                                  </Link>
                                </div>
                                <div className="flex items-center gap-2">
                                  <p className="font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                                    {typeof row.overall_score === "number" ? row.overall_score : "—"}
                                  </p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 rounded-[8px] border-zinc-500/80 bg-gradient-to-b from-[#D6DAE1] via-[#B2B7C0] to-[#8D929B] px-2.5 text-xs font-semibold text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:from-[#E0E3E9] hover:via-[#BCC1CA] hover:to-[#979CA5] dark:border-zinc-400 dark:from-[#A0A6AF] dark:via-[#7C828B] dark:to-[#616871] dark:text-zinc-100 dark:hover:from-[#AAB0B8] dark:hover:via-[#878D95] dark:hover:to-[#6B717A]"
                                    onClick={() =>
                                      setScoutCardPreview({
                                        type: "cv",
                                        role: row.job_category?.trim() || "General",
                                        score: typeof row.overall_score === "number" ? row.overall_score : 0,
                                        insight: shortSummary,
                                      })
                                    }
                                  >
                                    Scout Card
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}

              {selectedTab === "interviews" && (
                <>
                  {mockResults.length === 0 ? (
                    <div className="flex min-h-[180px] flex-col items-center justify-center gap-4 text-center">
                      <p className="text-sm text-zinc-900/72 dark:text-zinc-400">No mock interviews yet</p>
                      <Link
                        href="/mock-interview"
                        className="inline-flex h-8 items-center rounded-[10px] border border-zinc-200/90 bg-[#F5F4F2] px-3 text-sm font-semibold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        Start mock interview
                      </Link>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {mockResults.map((row) => {
                        const locale: InterviewLocale = parseInterviewLocale(row.interview_language ?? undefined);
                        const qs = new URLSearchParams({ lang: locale }).toString();
                        return (
                          <li key={row.id}>
                            <div className="group rounded-[10px] border border-zinc-200/80 bg-[#FDFDFC] px-4 py-3 transition-colors duration-200 hover:bg-[#FAFAF8] dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:bg-zinc-900">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <Link href={`/mock-interview/${row.id}/result?${qs}`} className="block min-w-0">
                                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                      {row.job_category?.trim() || "General"}
                                    </p>
                                    <p className="mt-1 text-sm text-zinc-900/72 dark:text-zinc-400">
                                      {row.created_at ? new Date(row.created_at).toLocaleDateString() : "Recent"}
                                    </p>
                                  </Link>
                                </div>
                                <div className="flex items-center gap-2">
                                  <p className="font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                                    {typeof row.score === "number" ? row.score : "—"}
                                  </p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 rounded-[8px] border-zinc-500/80 bg-gradient-to-b from-[#D6DAE1] via-[#B2B7C0] to-[#8D929B] px-2.5 text-xs font-semibold text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:from-[#E0E3E9] hover:via-[#BCC1CA] hover:to-[#979CA5] dark:border-zinc-400 dark:from-[#A0A6AF] dark:via-[#7C828B] dark:to-[#616871] dark:text-zinc-100 dark:hover:from-[#AAB0B8] dark:hover:via-[#878D95] dark:hover:to-[#6B717A]"
                                    onClick={() =>
                                      setScoutCardPreview({
                                        type: "interview",
                                        role: row.job_category?.trim() || "General",
                                        score: typeof row.score === "number" ? row.score : 0,
                                        insight: "Interview readiness snapshot",
                                      })
                                    }
                                  >
                                    Scout Card
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}

              {selectedTab === "applications" && (
                <>
                  {applications.length === 0 ? (
                    <div className="flex min-h-[180px] flex-col items-center justify-center gap-4 text-center">
                      <p className="text-sm text-zinc-900/72 dark:text-zinc-400">No applications yet</p>
                      <Link
                        href="/dashboard/jobs"
                        className="inline-flex h-8 items-center rounded-[10px] border border-zinc-200/90 bg-[#F5F4F2] px-3 text-sm font-semibold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        Browse jobs
                      </Link>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {applications.map((row) => {
                        const jobListing = Array.isArray(row.job_listings) ? row.job_listings[0] : row.job_listings;
                        return (
                          <li key={row.id}>
                            <Link
                              href={`/dashboard/applications/${row.id}`}
                              className="group block cursor-pointer rounded-[10px] border border-zinc-200/80 bg-[#FDFDFC] px-4 py-3 transition-colors duration-200 hover:bg-[#FAFAF8] dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:bg-zinc-900"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    {jobListing?.title?.trim() || "Job listing"}
                                  </p>
                                  <p className="mt-1 text-sm text-zinc-900/72 dark:text-zinc-400">
                                    {row.created_at ? new Date(row.created_at).toLocaleDateString() : "Recent"}
                                  </p>
                                </div>
                                <CandidateApplicationStatusBadge
                                  applicationStatus={row.application_status || "applied"}
                                />
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>
          </section>
        </Reveal>

      </div>

      <AnimatedDialog open={scoutCardPreview != null} onOpenChange={(open) => !open && setScoutCardPreview(null)}>
        <DialogPortal forceMount>
          <DialogOverlay className="bg-transparent backdrop-blur-[2px]" />
          <DialogContent className="w-[min(92vw,470px)] max-w-none border-white/25 bg-white/22 px-2.5 py-3 shadow-[0_28px_80px_-44px_rgba(0,0,0,0.55)] backdrop-blur-xl dark:border-white/[0.16] dark:bg-zinc-950/24 md:px-3 md:py-4">
            <DialogTitle className="text-center">Scout Card</DialogTitle>
            {scoutCardPreview && (
              <div className="mt-2">
                <SocialCardSharePanel
                  title="Share card"
                  fileName={
                    scoutCardPreview.type === "cv" ? "openscout-cv-analysis" : "openscout-interview-result"
                  }
                  shareText={
                    scoutCardPreview.type === "cv"
                      ? `My OpenScout CV score: ${scoutCardPreview.score}/100`
                      : `My OpenScout interview score: ${scoutCardPreview.score}/100`
                  }
                  frameless
                  compactPreview
                  hideHeader
                  centerActions
                >
                  {scoutCardPreview.type === "cv" ? (
                    <CvAnalysisCard
                      role={scoutCardPreview.role}
                      score={scoutCardPreview.score}
                      insightLine={scoutCardPreview.insight}
                      firstName={firstName}
                    />
                  ) : (
                    <InterviewResultCard
                      role={scoutCardPreview.role}
                      score={scoutCardPreview.score}
                      evaluationLine={scoutCardPreview.insight}
                      firstName={firstName}
                    />
                  )}
                </SocialCardSharePanel>
              </div>
            )}
          </DialogContent>
        </DialogPortal>
      </AnimatedDialog>
    </div>
  );
}
