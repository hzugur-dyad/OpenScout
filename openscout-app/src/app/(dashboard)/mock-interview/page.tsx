"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MessageCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { JOB_TITLES } from "@/constants/jobFormOptions";
import { UsageBanner } from "@/components/dashboard/UsageBanner";
import { CVAnalysisPageSkeleton } from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import { INTERVIEW_LOCALE_LABEL, interviewUi, type InterviewLocale } from "@/lib/interview-locale";
import { getDefaultInterviewLocale } from "@/lib/default-interview-locale";
import { getJobTitleBySlug } from "@/lib/seo/job-titles";
import { computeCvReadiness, type CvReadiness } from "@/lib/cv-readiness";

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

function jobTitleFromJobQuery(searchParams: ReturnType<typeof useSearchParams>): string | null {
  const slug = searchParams.get("job");
  if (!slug) return null;
  const title = getJobTitleBySlug(slug);
  if (!title || !(JOB_TITLES as readonly string[]).includes(title)) return null;
  return title;
}

function MockInterviewContent() {
  const searchParams = useSearchParams();
  const [jobCategory, setJobCategory] = useState<string>(() => jobTitleFromJobQuery(searchParams) ?? JOB_TITLES[0]);
  const [interviewLang, setInterviewLang] = useState<InterviewLocale>("en");
  const ui = interviewUi[interviewLang];

  useEffect(() => {
    setInterviewLang(getDefaultInterviewLocale());
  }, []);
  const [readiness, setReadiness] = useState<CvReadiness | null>(null);
  const [guardLoading, setGuardLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadGuard() {
      const { data: { user } } = await supabase.auth.getUser();
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
      const profile = profileRes.data as { first_name?: string; last_name?: string; email?: string; location?: string } | null;
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

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">{ui.mockInterviewTitle}</h1>
      <p className="mt-1 text-gray-500">
        {ui.mockInterviewSubtitle}
      </p>

      <UsageBanner feature="mock_interview" />

      {guardLoading ? (
        <div className="mt-8">
          <CVAnalysisPageSkeleton />
        </div>
      ) : showProfileGate && readiness ? (
        <div className="mt-8 rounded-[10px] border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-start gap-3 text-amber-800 dark:text-amber-200">
            <AlertCircle className="h-6 w-6 shrink-0" />
            <div>
              <h3 className="font-semibold">{ui.profileIncompleteTitle}</h3>
              <p className="mt-1 text-sm dark:text-amber-200/90">{ui.profileIncompleteBody}</p>
              {readiness.missingProfileFieldKeys.length > 0 && (
                <p className="mt-2 text-sm dark:text-amber-200/90">
                  {ui.missingPrefix}:{" "}
                  {readiness.missingProfileFieldKeys
                    .map((k) => PROFILE_FIELD_LABEL[interviewLang][k] ?? k)
                    .join(", ")}
                  .
                </p>
              )}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link href="/onboarding">
              <Button variant="primary">{ui.completeProfile}</Button>
            </Link>
            <Link href="/cv-analysis">
              <Button variant="outline">{ui.runCvAnalysis}</Button>
            </Link>
          </div>
        </div>
      ) : showNoCvGate && readiness ? (
        <div className="mt-8 rounded-[10px] border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-start gap-3 text-amber-800 dark:text-amber-200">
            <AlertCircle className="h-6 w-6 shrink-0" />
            <div>
              <h3 className="font-semibold">{ui.noCvMaterialTitle}</h3>
              <p className="mt-1 text-sm dark:text-amber-200/90">{ui.noCvMaterialBody}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link href="/onboarding">
              <Button variant="primary">{ui.completeProfile}</Button>
            </Link>
            <Link href="/cv-analysis">
              <Button variant="outline">{ui.runCvAnalysis}</Button>
            </Link>
          </div>
        </div>
      ) : showAnalysisNudge && readiness ? (
        <div className="mt-8 rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
          <div className="flex items-start gap-3 text-gray-800 dark:text-zinc-200">
            <AlertCircle className="h-6 w-6 shrink-0 text-[var(--primary)]" />
            <div>
              <h3 className="font-semibold">{ui.cvAnalysisNudgeTitle}</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">{ui.cvAnalysisNudgeBody}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link href="/cv-analysis">
              <Button variant="primary">{ui.runCvAnalysis}</Button>
            </Link>
            <Link href="/onboarding">
              <Button variant="outline">{ui.completeProfile}</Button>
            </Link>
          </div>
        </div>
      ) : showMainFlow ? (
        <div className="mt-8 space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">{ui.interviewLanguage}</label>
            <CustomSelect
              options={[
                { value: "en", label: INTERVIEW_LOCALE_LABEL.en },
                { value: "tr", label: INTERVIEW_LOCALE_LABEL.tr },
              ]}
              value={interviewLang}
              onChange={(v) => setInterviewLang(v === "tr" ? "tr" : "en")}
              aria-label={ui.interviewLanguage}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">{ui.jobCategory}</label>
            <CustomSelect
              options={JOB_TITLES}
              value={jobCategory}
              onChange={setJobCategory}
              aria-label={ui.jobCategory}
            />
          </div>

          <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">{ui.whatToExpect}</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-zinc-400">
              {ui.expectBullets.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
          </div>

          <div className="flex gap-4">
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleStart}
              icon={MessageCircle}
            >
              {ui.startInterview}
            </Button>
          </div>
        </div>
      ) : null}
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
