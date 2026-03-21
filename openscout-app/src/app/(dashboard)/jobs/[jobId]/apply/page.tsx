"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { INTERVIEW_LOCALE_LABEL, type InterviewLocale } from "@/lib/interview-locale";
import { getDefaultInterviewLocale } from "@/lib/default-interview-locale";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";
import { CVAnalysisLoadingSkeleton, JobApplyPageSkeleton } from "@/components/ui/Skeleton";
import { computeCvReadiness, CV_READINESS_COPY_EN, type CvReadiness } from "@/lib/cv-readiness";

export default function JobApplyPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;
  const supabase = createClient();

  const [job, setJob] = useState<{
    id: string;
    title: string;
    min_cv_score: number | null;
    is_active: boolean;
    companies: { name: string } | null;
  } | null>(null);
  const [cvScore, setCvScore] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<CvReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [interviewLang, setInterviewLang] = useState<InterviewLocale>("en");
  const applicationStartedTracked = useRef(false);

  useEffect(() => {
    setInterviewLang(getDefaultInterviewLocale());
  }, []);

  useEffect(() => {
    async function load() {
      const { data: jobData, error: jobError } = await supabase
        .from("job_listings")
        .select("id, title, min_cv_score, is_active, companies(name)")
        .eq("id", jobId)
        .eq("is_active", true)
        .maybeSingle();

      if (jobError || !jobData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setJob(jobData as unknown as typeof job);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [{ data: profile }, { data: privateRow }, { data: anyAnalysis }] = await Promise.all([
        supabase
          .from("profiles")
          .select("first_name, last_name, email, location")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("profile_private")
          .select("cv_file_url, cv_raw_text")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("cv_analyses").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
      ]);

      const p = profile as { first_name?: string; last_name?: string; email?: string; location?: string } | null;
      const pv = privateRow as { cv_file_url?: string; cv_raw_text?: string } | null;
      const r = computeCvReadiness({
        profile: p,
        cvFileUrl: pv?.cv_file_url,
        cvRawText: pv?.cv_raw_text,
        hasCvAnalysisRow: anyAnalysis != null,
      });
      setReadiness(r);

      if (r.canAccessFlow) {
        // Check for existing analysis for this job
        const { data: existingAnalysis } = await supabase
          .from("cv_analyses")
          .select("overall_score")
          .eq("user_id", user.id)
          .eq("job_id", jobId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingAnalysis) {
          setCvScore(existingAnalysis.overall_score);
        }
      }

      if (user && jobData && !applicationStartedTracked.current) {
        applicationStartedTracked.current = true;
        trackClient(ANALYTICS_EVENTS.application_started, { job_id: jobId });
      }

      setLoading(false);
    }
    load();
  }, [jobId, supabase]);

  async function runAutoAnalysis() {
    setAnalyzing(true);
    setAnalyzeError(null);
    trackClient(ANALYTICS_EVENTS.cv_analysis_started, { source: "auto", job_id: jobId });
    try {
      const res = await fetch("/api/cv-analysis/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnalyzeError(data.error || "Analysis failed");
        return;
      }
      setCvScore(data.overall_score);
    } catch {
      setAnalyzeError("Network error. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return <JobApplyPageSkeleton />;
  }

  if (notFound || !job) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard/jobs" className="text-sm text-gray-500 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200">← Back to jobs</Link>
        <div className="mt-8 rounded-[10px] border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200">Job not found</h2>
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">This listing may have been removed or is no longer accepting applications.</p>
          <Link href="/dashboard/jobs" className="mt-4 inline-block"><Button variant="outline">Browse jobs</Button></Link>
        </div>
      </div>
    );
  }

  const minScore = job.min_cv_score ?? 0;
  const canProceed = cvScore !== null && cvScore >= minScore;

  // Guard: same CV readiness rule as mock interview (profile + uploaded CV or any analysis)
  if (readiness && !readiness.canAccessFlow) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link href={`/dashboard/jobs/${jobId}`} className="text-sm text-gray-500 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200">← Back to job</Link>
        <h1 className="mt-6 text-2xl font-bold text-gray-900 dark:text-zinc-100">{job.title} - Application</h1>
        <p className="mt-1 text-gray-500 dark:text-zinc-400">{(job.companies as { name: string })?.name || "Company"}</p>
        <div className="mt-8 rounded-[10px] border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-start gap-3 text-amber-800 dark:text-amber-200">
            <AlertCircle className="h-6 w-6 shrink-0" />
            <div>
              <h3 className="font-semibold">{CV_READINESS_COPY_EN.applyGateTitle}</h3>
              <div className="mt-1 space-y-2 text-sm dark:text-amber-300">
                {!readiness.profileComplete && <p>{CV_READINESS_COPY_EN.applyGateProfileHint}</p>}
                {readiness.profileComplete && !readiness.hasUploadedCv && !readiness.hasCvAnalysis && (
                  <p>{CV_READINESS_COPY_EN.applyGateNoCvHint}</p>
                )}
              </div>
              {readiness.missingProfileFieldKeys.length > 0 && (
                <p className="mt-2 text-sm dark:text-amber-300">
                  Missing:{" "}
                  {readiness.missingProfileFieldKeys
                    .map((k) =>
                      k === "first_name"
                        ? "First name"
                        : k === "last_name"
                          ? "Last name"
                          : k === "email"
                            ? "Email"
                            : "Location"
                    )
                    .join(", ")}
                  .
                </p>
              )}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link href="/onboarding">
              <Button variant="primary">Complete profile / CV</Button>
            </Link>
            <Link href="/cv-analysis">
              <Button variant="outline">Run CV analysis</Button>
            </Link>
            <Link href={`/dashboard/jobs/${jobId}`}>
              <Button variant="outline">Go back</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/dashboard/jobs/${jobId}`} className="text-sm text-gray-500 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200">← Back to job</Link>
      <h1 className="mt-6 text-2xl font-bold text-gray-900 dark:text-zinc-100">{job.title} - Application</h1>
      <p className="mt-1 text-gray-500 dark:text-zinc-400">{(job.companies as { name: string })?.name || "Company"}</p>

      <div className="mt-8 rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
        {/* Step 1: Analyze CV */}
        {cvScore === null && !analyzing && (
          <>
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">{CV_READINESS_COPY_EN.applyStep1Title}</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">{CV_READINESS_COPY_EN.applyStep1Body}</p>
            {analyzeError && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{analyzeError}</div>
            )}
            <Button variant="primary" className="mt-4" onClick={runAutoAnalysis}>
              {CV_READINESS_COPY_EN.applyAnalyzeButton}
            </Button>
          </>
        )}

        {/* Analyzing */}
        {analyzing && (
          <div className="py-4">
            <p className="mb-4 text-center text-sm font-medium text-gray-700 dark:text-zinc-300">
              {CV_READINESS_COPY_EN.applyAnalyzingLabel}
            </p>
            <CVAnalysisLoadingSkeleton />
          </div>
        )}

        {/* Score too low */}
        {cvScore !== null && !canProceed && (
          <div className="flex items-start gap-3 text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-6 w-6 shrink-0" />
            <div>
              <h3 className="font-semibold">Your CV score does not meet the minimum requirement for this position.</h3>
              <p className="mt-2 text-sm">
                Please update your CV and try again. You can re-upload your CV from your profile page.
              </p>
            </div>
          </div>
        )}
        {cvScore !== null && !canProceed && (
          <div className="mt-6 flex gap-4">
            <Link href="/onboarding"><Button variant="primary">Update CV</Button></Link>
            <Link href={`/dashboard/jobs/${jobId}`}><Button variant="outline">Go Back</Button></Link>
          </div>
        )}

        {/* Qualified - proceed to interview */}
        {canProceed && (
          <>
            <div className="flex items-center gap-3 text-green-700 dark:text-green-300">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-sm font-bold dark:bg-green-900/40 dark:border dark:border-green-700/50 dark:text-green-300">OK</span>
              <div>
                <h3 className="font-semibold">You qualify for the interview</h3>
                <p className="text-sm dark:text-zinc-400">Your CV meets the requirements for this position.</p>
              </div>
            </div>
            <div className="mt-6 max-w-xs">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                Interview language
              </label>
              <CustomSelect
                options={[
                  { value: "en", label: INTERVIEW_LOCALE_LABEL.en },
                  { value: "tr", label: INTERVIEW_LOCALE_LABEL.tr },
                ]}
                value={interviewLang}
                onChange={(value) => setInterviewLang(value === "tr" ? "tr" : "en")}
                aria-label="Interview language"
              />
            </div>
            <Button
              variant="primary"
              className="mt-6"
              onClick={() =>
                router.push(
                  `/mock-interview/${crypto.randomUUID()}?category=${encodeURIComponent(job.title)}&jobId=${jobId}&cvScore=${cvScore ?? ""}&lang=${encodeURIComponent(interviewLang)}`
                )
              }
            >
              Start AI Interview
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
