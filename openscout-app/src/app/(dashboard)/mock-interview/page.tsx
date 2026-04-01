"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Newsreader } from "next/font/google";
import { ChatCircle, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { JOB_TITLES } from "@/constants/jobFormOptions";
import { UsageBanner } from "@/components/dashboard/UsageBanner";
import { CVAnalysisPageSkeleton } from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import { interviewUi, type InterviewLocale } from "@/lib/interview-locale";
import { getDefaultInterviewLocale } from "@/lib/default-interview-locale";
import { getJobTitleBySlug } from "@/lib/seo/job-titles";
import { computeCvReadiness, type CvReadiness } from "@/lib/cv-readiness";
import { cn } from "@/lib/utils";

const editorialSerif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600"],
});

const EASE_MINIMAL: [number, number, number, number] = [0.16, 1, 0.3, 1];

const PROFILE_FIELD_LABEL: Record<InterviewLocale, Record<string, string>> = {
  en: {
    first_name: "First name",
    last_name: "Last name",
    email: "Email",
    location: "Location",
  },
  tr: {
    first_name: "Ad",
    last_name: "Soyad",
    email: "E-posta",
    location: "Konum",
  },
};

/** Off-white surface, hairline stroke, no drop shadow (border defines edges on light UI). */
const surfaceCard =
  "rounded-[10px] border border-zinc-200/90 bg-[#F4F4F3] transition-colors duration-200 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700";

const selectTriggerMinimal =
  "rounded-[10px] border border-[#E8E8E6] bg-[#FAFAF9] py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBFBFA] dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-950";

const btnPrimary =
  `inline-flex min-h-11 min-w-[180px] touch-manipulation items-center justify-center gap-2 rounded-[10px] bg-[#111111] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2a2a2a] active:bg-[#000000] active:scale-[0.98] motion-reduce:active:scale-100 dark:bg-zinc-100 dark:font-semibold dark:text-zinc-950 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 ${focusRing}`;

const btnOutline =
  `inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-[10px] border border-[#E8E8E6] bg-[#FAFAF9] px-5 py-2.5 text-sm font-semibold text-[#111111] transition-colors hover:bg-[#F2F1EF] active:bg-[#EAE9E6] active:scale-[0.98] motion-reduce:active:scale-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:active:bg-zinc-800/90 ${focusRing}`;

function jobTitleFromJobQuery(searchParams: ReturnType<typeof useSearchParams>): string | null {
  const slug = searchParams.get("job");
  if (!slug) return null;
  const title = getJobTitleBySlug(slug);
  if (!title || !(JOB_TITLES as readonly string[]).includes(title)) return null;
  return title;
}

function MockInterviewContent() {
  const reduceMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const [jobCategory, setJobCategory] = useState<string>(() => jobTitleFromJobQuery(searchParams) ?? JOB_TITLES[0]);
  const [interviewLang, setInterviewLang] = useState<InterviewLocale>("en");
  const ui = interviewUi.en;

  useEffect(() => {
    setInterviewLang(getDefaultInterviewLocale());
  }, []);
  const [readiness, setReadiness] = useState<CvReadiness | null>(null);
  const [guardLoading, setGuardLoading] = useState(true);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadGuard() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setReadiness(null);
        setGuardLoading(false);
        return;
      }
      const [profileRes, privateRes, cvRes] = await Promise.all([
        supabase.from("profiles").select("first_name, last_name, email, location").eq("user_id", user.id).maybeSingle(),
        supabase.from("profile_private").select("cv_file_url, cv_raw_text").eq("user_id", user.id).maybeSingle(),
        supabase.from("cv_analyses").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
      ]);
      const profile = profileRes.data as
        | { first_name?: string; last_name?: string; email?: string; location?: string }
        | null;
      const pv = privateRes.data as { cv_file_url?: string | null; cv_raw_text?: string | null } | null;
      setReadiness(
        computeCvReadiness({
          profile,
          cvFileUrl: pv?.cv_file_url,
          cvRawText: pv?.cv_raw_text,
          hasCvAnalysisRow: cvRes.data != null,
        })
      );
      setGuardLoading(false);
    }
    loadGuard();
  }, [supabase]);

  useEffect(() => {
    const fromUrl = jobTitleFromJobQuery(searchParams);
    if (fromUrl) setJobCategory(fromUrl);
  }, [searchParams]);

  function handleStart() {
    const id = crypto.randomUUID();
    router.push(
      `/mock-interview/${id}?category=${encodeURIComponent(jobCategory)}&lang=${encodeURIComponent(interviewLang)}`
    );
  }

  const showProfileGate = !!(readiness && !readiness.profileComplete);
  const showNoCvGate = !!(readiness && readiness.profileComplete && !readiness.canAccessFlow);
  const showAnalysisNudge = !!(readiness && readiness.needsCvAnalysisBeforeInterview);
  const showMainFlow =
    !guardLoading && (!readiness || (readiness.canAccessFlow && !readiness.needsCvAnalysisBeforeInterview));

  const gateWarningSurface =
    "rounded-[10px] border border-[#E8E4DA] bg-[#F5F1EA] dark:border-zinc-800 dark:bg-[#1f1c14]/90";

  const nudgeSurface =
    "rounded-[10px] border border-[#DDE4EA] bg-[#EEF2F5] dark:border-zinc-800 dark:bg-zinc-900";

  return (
    <div className="relative min-h-[100dvh] bg-transparent dark:bg-transparent">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden
        style={{
          background: "radial-gradient(ellipse 90% 50% at 50% -15%, rgba(0,0,0,0.01), transparent 55%)",
        }}
      />
      <main id="mock-interview-main" className="relative z-10 mx-auto max-w-5xl px-4 py-2 md:py-3">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 0.6, ease: EASE_MINIMAL }
          }
          className="flex flex-col items-center"
        >
          <header className="w-full text-center">
            <h1
              className={cn(
                editorialSerif.className,
                "text-xl font-semibold leading-tight tracking-[-0.03em] text-[#111111] sm:text-2xl md:text-[1.65rem] dark:text-zinc-50"
              )}
            >
              {ui.mockInterviewTitle}
            </h1>
            <p className="mx-auto mt-1.5 max-w-[52ch] text-sm leading-snug text-[#5f5e5a] dark:text-zinc-400">
              {ui.mockInterviewSubtitle}
            </p>
          </header>

          <div className="mt-2 w-full">
            <UsageBanner feature="mock_interview" />
          </div>

          <div className="mt-2 w-full">
            {guardLoading ? (
              <div className={cn(surfaceCard, "p-4 md:p-5")}>
                <CVAnalysisPageSkeleton />
              </div>
            ) : showProfileGate && readiness ? (
              <motion.div
                className={cn(gateWarningSurface, "p-4 md:p-5")}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.6, ease: EASE_MINIMAL, delay: 0.06 }
                }
              >
                <div className="flex flex-col items-center gap-2.5 sm:flex-row sm:items-start sm:gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/70 dark:bg-zinc-950/40"
                    aria-hidden
                  >
                    <WarningCircle className="h-5 w-5 text-[#956400] dark:text-amber-300" weight="bold" />
                  </div>
                  <div className="min-w-0 text-center sm:text-left">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.05em] text-[#956400] dark:text-amber-200">
                      {ui.profileIncompleteTitle}
                    </h3>
                    <p className="mt-1 text-sm leading-snug text-[#111111]/85 dark:text-zinc-200">
                      {ui.profileIncompleteBody}
                    </p>
                    {readiness.missingProfileFieldKeys.length > 0 && (
                      <p className="mt-1 text-sm leading-snug text-[#111111]/85 dark:text-zinc-200">
                        {ui.missingPrefix}{" "}
                        {readiness.missingProfileFieldKeys
                          .map((k) => PROFILE_FIELD_LABEL.en[k] ?? k)
                          .join(", ")}
                        .
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <Link href="/onboarding" className={btnPrimary}>
                    {ui.completeProfile}
                  </Link>
                  <Link href="/cv-analysis" className={btnOutline}>
                    {ui.runCvAnalysis}
                  </Link>
                </div>
              </motion.div>
            ) : showNoCvGate && readiness ? (
              <motion.div
                className={cn(gateWarningSurface, "p-4 md:p-5")}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.6, ease: EASE_MINIMAL, delay: 0.06 }
                }
              >
                <div className="flex flex-col items-center gap-2.5 sm:flex-row sm:items-start sm:gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/70 dark:bg-zinc-950/40"
                    aria-hidden
                  >
                    <WarningCircle className="h-5 w-5 text-[#956400] dark:text-amber-300" weight="bold" />
                  </div>
                  <div className="min-w-0 text-center sm:text-left">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.05em] text-[#956400] dark:text-amber-200">
                      {ui.noCvMaterialTitle}
                    </h3>
                    <p className="mt-2 text-sm leading-[1.6] text-[#111111]/85 dark:text-zinc-200">
                      {ui.noCvMaterialBody}
                    </p>
                  </div>
                </div>
                <div className="mt-8 flex flex-wrap justify-center gap-3 sm:justify-start">
                  <Link href="/onboarding" className={btnPrimary}>
                    {ui.completeProfile}
                  </Link>
                  <Link href="/cv-analysis" className={btnOutline}>
                    {ui.runCvAnalysis}
                  </Link>
                </div>
              </motion.div>
            ) : showAnalysisNudge && readiness ? (
              <motion.div
                className={cn(nudgeSurface, "p-4 md:p-5")}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.6, ease: EASE_MINIMAL, delay: 0.06 }
                }
              >
                <div className="flex flex-col items-center gap-2.5 sm:flex-row sm:items-start sm:gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80 dark:bg-zinc-800/80"
                    aria-hidden
                  >
                    <WarningCircle className="h-5 w-5 text-[#1F6C9F] dark:text-sky-300" weight="bold" />
                  </div>
                  <div className="min-w-0 text-center sm:text-left">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.05em] text-[#1F6C9F] dark:text-sky-200">
                      {ui.cvAnalysisNudgeTitle}
                    </h3>
                    <p className="mt-1 text-sm leading-snug text-[#111111]/80 dark:text-zinc-300">
                      {ui.cvAnalysisNudgeBody}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <Link href="/cv-analysis" className={btnPrimary}>
                    {ui.runCvAnalysis}
                  </Link>
                  <Link href="/onboarding" className={btnOutline}>
                    {ui.completeProfile}
                  </Link>
                </div>
              </motion.div>
            ) : showMainFlow ? (
              <div className={cn(surfaceCard, "p-4 md:p-5")}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                  <div className="flex flex-col gap-2">
                    <label
                      className="text-xs font-normal uppercase tracking-[0.06em] text-[#111111]/72 dark:text-zinc-500"
                      htmlFor="mock-interview-lang"
                    >
                      {ui.interviewLanguage}
                    </label>
                    <CustomSelect
                      id="mock-interview-lang"
                      triggerClassName={selectTriggerMinimal}
                      options={[
                        { value: "en", label: "English" },
                        { value: "tr", label: "Turkish" },
                      ]}
                      value={interviewLang}
                      onChange={(v) => setInterviewLang(v === "tr" ? "tr" : "en")}
                      aria-label={ui.interviewLanguage}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label
                      className="text-xs font-normal uppercase tracking-[0.06em] text-[#111111]/72 dark:text-zinc-500"
                      htmlFor="mock-interview-job"
                    >
                      {ui.jobCategory}
                    </label>
                    <CustomSelect
                      id="mock-interview-job"
                      triggerClassName={selectTriggerMinimal}
                      options={JOB_TITLES}
                      value={jobCategory}
                      onChange={setJobCategory}
                      searchable
                      searchPlaceholder="Search category..."
                      noResultsText="No results found"
                      aria-label={ui.jobCategory}
                    />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                  <section>
                    <h3 className="text-left text-xs font-normal uppercase tracking-[0.08em] text-[#111111]/72 dark:text-zinc-500">
                      {ui.whatToExpect}
                    </h3>
                    <ul className="mt-3 space-y-2.5" role="list">
                      {ui.expectBullets.map((line) => (
                        <li key={line} className="flex gap-3">
                          <CheckCircle
                            className="mt-0.5 h-4 w-4 shrink-0 text-[#3d5c40] opacity-90 dark:text-emerald-500/90"
                            weight="regular"
                            aria-hidden
                          />
                          <span className="text-sm font-normal leading-[1.45] text-[#111111]/70 dark:text-zinc-400">
                            {line}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <h3 className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-red-700 dark:text-red-300">
                      {ui.interviewTipsTitle}
                    </h3>
                    <ul className="mt-3 space-y-2.5" role="list">
                      {ui.interviewTipsBullets.map((line) => (
                        <li key={line} className="flex gap-3">
                          <WarningCircle
                            className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
                            weight="fill"
                            aria-hidden
                          />
                          <span className="text-sm font-normal leading-[1.45] text-[#111111]/70 dark:text-zinc-400">
                            {line}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>

                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={handleStart}
                    className={btnPrimary}
                  >
                    <ChatCircle className="h-4 w-4 shrink-0" weight="bold" aria-hidden />
                    {ui.startInterview}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default function MockInterviewPage() {
  return (
    <Suspense fallback={<CVAnalysisPageSkeleton />}>
      <MockInterviewContent />
    </Suspense>
  );
}
