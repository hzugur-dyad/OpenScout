"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Newsreader } from "next/font/google";
import {
  ArrowRight,
  CheckCircle,
  FileText,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { JOB_TITLES } from "@/constants/jobFormOptions";
import { UsageBanner } from "@/components/dashboard/UsageBanner";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";
import type { AnalysisResult } from "@/types/schemas";
import { CVAnalysisLoadingSkeleton, CVAnalysisPageSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { mapCvAnalysisClientError, messageFromApiErrorBody } from "@/lib/user-facing-errors";
import { captureException } from "@/lib/monitoring";

const editorial = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600"],
});

const quietEase = [0.16, 1, 0.3, 1] as const;

/** Report surfaces — elevated cards aligned with product shell */
const panel = "os-surface-card";

const ctaClass =
  "rounded-[10px] bg-zinc-900 text-white shadow-none transition-colors duration-200 ease-out hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";

const labelMuted = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-500";

const bodySecondary = "text-zinc-600 dark:text-zinc-400";

function scoreAccent(score: number): {
  bar: string;
  disk: string;
  diskText: string;
} {
  if (score >= 70) {
    return {
      bar: "bg-[#346538]/35 dark:bg-[#346538]/45",
      disk: "bg-[#EDF3EC] dark:bg-[#1a2e1c]",
      diskText: "text-[#346538] dark:text-[#a3c4a5]",
    };
  }
  if (score >= 50) {
    return {
      bar: "bg-[#956400]/30 dark:bg-[#c9a227]/35",
      disk: "bg-[#FBF3DB] dark:bg-[#2d2610]",
      diskText: "text-[#956400] dark:text-[#e8d48a]",
    };
  }
  return {
    bar: "bg-[#9F2F2D]/30 dark:bg-[#c45c5a]/35",
    disk: "bg-[#FDEBEC] dark:bg-[#2c1516]",
    diskText: "text-[#9F2F2D] dark:text-[#e8a8a6]",
  };
}

function CVAnalysisContent() {
  const searchParams = useSearchParams();
  const jobIdFromUrl = searchParams.get("jobId") ?? undefined;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const categoryFromUrl = searchParams.get("category");
  const initialCategory =
    categoryFromUrl && JOB_TITLES.includes(categoryFromUrl as (typeof JOB_TITLES)[number])
      ? categoryFromUrl
      : JOB_TITLES[0];
  const [jobCategory, setJobCategory] = useState(initialCategory);

  useEffect(() => {
    if (categoryFromUrl && JOB_TITLES.includes(categoryFromUrl as (typeof JOB_TITLES)[number])) {
      setJobCategory(categoryFromUrl);
    }
  }, [categoryFromUrl]);

  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const isValidFile = useCallback((f: File) => {
    const maxMb = 10;
    if (f.size > maxMb * 1024 * 1024) return false;
    return (
      f.type === "application/pdf" ||
      f.name.toLowerCase().endsWith(".pdf") ||
      f.name.toLowerCase().endsWith(".txt")
    );
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (!f) return;
      if (isValidFile(f)) {
        setFile(f);
        setError(null);
      } else {
        setError("Please upload a PDF or TXT file (max 10MB). DOC/DOCX are not supported.");
      }
    },
    [isValidFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (isValidFile(f)) {
      setFile(f);
      setError(null);
    } else {
      setError("Please upload a PDF or TXT file (max 10MB). DOC/DOCX are not supported.");
      setFile(null);
    }
    e.target.value = "";
  };

  async function handleAnalyze() {
    if (!file) {
      setError("Please upload a CV first");
      return;
    }
    setError(null);
    setIsLoading(true);
    trackClient(ANALYTICS_EVENTS.cv_analysis_started, {
      source: "manual",
      job_category: jobCategory,
      ...(jobIdFromUrl ? { job_id: jobIdFromUrl } : {}),
    });
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("jobCategory", jobCategory);
      if (jobIdFromUrl) formData.append("jobId", jobIdFromUrl);

      const res = await fetch("/api/cv-analysis", {
        method: "POST",
        body: formData,
      });
      let data: unknown = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        const apiMsg = messageFromApiErrorBody(
          data,
          "We could not analyze your CV right now. Please try again."
        );
        throw new Error(apiMsg);
      }
      setResult(data as AnalysisResult);
    } catch (e) {
      if (e instanceof Error) {
        setError(mapCvAnalysisClientError(e.message));
        captureException(e, { route: "/cv-analysis", tags: { cv_analysis_source: "manual" } });
      } else {
        setError(mapCvAnalysisClientError(""));
        captureException(new Error(String(e)), { route: "/cv-analysis", tags: { cv_analysis_source: "manual" } });
      }
    } finally {
      setIsLoading(false);
    }
  }

  const overallAccent = result ? scoreAccent(result.overall_score) : null;

  return (
    <div className="relative isolate mx-auto w-full max-w-4xl px-4 pb-20 pt-2">
      {!result ? (
        isLoading ? (
          <CVAnalysisLoadingSkeleton />
        ) : (
          <div className="space-y-12 sm:space-y-16">
            <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:gap-6 sm:text-left">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-zinc-200/90 bg-[#F4F4F3] dark:border-zinc-800 dark:bg-zinc-900">
                <FileText className="h-5 w-5 text-zinc-800 dark:text-zinc-300" weight="bold" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h1
                  className={cn(
                    editorial.className,
                    "text-[2rem] font-semibold leading-[1.2] tracking-[-0.03em] text-zinc-900 sm:text-[2.25rem] dark:text-zinc-50"
                  )}
                >
                  CV Analysis
                </h1>
                <p
                  className={cn(
                    "mx-auto mt-4 max-w-[65ch] text-base leading-[1.5] sm:mx-0",
                    bodySecondary
                  )}
                >
                  Upload a PDF or plain-text CV, pick a target role, and receive notes you can edit against.
                </p>
              </div>
            </header>

            <UsageBanner feature="cv_analysis" />

            <div className="space-y-8">
              <div className="flex flex-col gap-2">
                <label htmlFor="cv-job-category" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Job category
                </label>
                <CustomSelect
                  options={JOB_TITLES}
                  value={jobCategory}
                  onChange={setJobCategory}
                  aria-label="Job category"
                  id="cv-job-category"
                />
                <p className={cn("text-xs leading-[1.5]", bodySecondary)}>
                  Limits and scoring use this category for the current run.
                </p>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  "rounded-[10px] border border-dashed p-8 transition-colors duration-200 ease-out md:p-10",
                  "bg-[#F6F6F5] dark:bg-zinc-950/60",
                  isDragging
                    ? "border-amber-600/35 bg-amber-50/50 dark:border-amber-900/45 dark:bg-amber-950/25"
                    : "border-zinc-200/90 dark:border-zinc-800"
                )}
              >
                <div className="flex flex-col items-center text-center">
                  <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-[10px] border border-zinc-200/90 bg-[#FAFAFA] dark:border-zinc-800 dark:bg-zinc-900">
                    <UploadSimple className="h-6 w-6 text-zinc-500 dark:text-zinc-400" weight="bold" aria-hidden />
                  </span>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Drop a file or browse</p>
                  <p className={cn("mt-1 text-xs", bodySecondary)}>PDF or TXT, up to 10MB</p>
                  {!file ? (
                    <p className={cn("mt-4 max-w-sm text-xs leading-[1.5]", bodySecondary)}>
                      One document per analysis keeps text extraction stable.
                    </p>
                  ) : null}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,application/pdf,text/plain"
                    onChange={handleFileChange}
                    className="sr-only"
                    id="cv-upload"
                    aria-label="Select CV file"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="mt-6 rounded-[10px] border-zinc-200/90 shadow-none transition-colors duration-200 ease-out hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Browse files
                  </Button>
                  {file ? (
                    <p className="mt-4 max-w-full truncate font-mono text-sm text-zinc-800 dark:text-zinc-300" title={file.name}>
                      <span className="font-sans font-medium">Selected:</span> {file.name}
                    </p>
                  ) : null}
                </div>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-[10px] border border-red-200/80 bg-red-50/90 p-4 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200/90"
                >
                  <WarningCircle className="mt-0.5 h-5 w-5 shrink-0" weight="bold" aria-hidden />
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
                <Button
                  variant="primary"
                  className={cn("w-full sm:w-auto sm:min-w-[12rem]", ctaClass)}
                  onClick={handleAnalyze}
                  disabled={isLoading}
                >
                  Run analysis
                </Button>
              </div>
            </div>
          </div>
        )
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: quietEase }}
          className="space-y-12 sm:space-y-16"
        >
          <header className="grid gap-8 md:grid-cols-2 md:items-start md:gap-10">
            <div>
              <p className={labelMuted}>Results</p>
              <h1
                className={cn(
                  editorial.className,
                  "mt-2 text-[1.75rem] font-semibold leading-[1.2] tracking-[-0.03em] text-zinc-900 sm:text-[2rem] dark:text-zinc-50"
                )}
              >
                Review for {jobCategory}
              </h1>
              <p className={cn("mt-4 max-w-[65ch] text-base leading-[1.5]", bodySecondary)}>
                Numbers use category weights. Strengths are anchors; improvements are edit targets.
              </p>
            </div>
            <div
              className={cn(
                panel,
                "flex items-center gap-4 p-6 transition-colors duration-200 ease-out hover:border-zinc-300/95 dark:hover:border-zinc-600"
              )}
            >
              <div
                className={cn(
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-xl font-semibold tabular-nums",
                  overallAccent!.disk,
                  overallAccent!.diskText
                )}
              >
                {result.overall_score}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#111111] dark:text-zinc-100">Overall score</p>
                <p className="mt-0.5 font-mono text-xs text-[#787774] dark:text-zinc-500">/ 100</p>
              </div>
            </div>
          </header>

          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div className="space-y-10">
              {result.cv_holder &&
              (result.cv_holder.full_name ||
                result.cv_holder.current_role ||
                result.cv_holder.summary_line) ? (
                <section className={cn(panel, "p-6 md:p-8")}>
                  <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#787774] dark:text-zinc-500">
                    Parsed profile
                  </h2>
                  <dl className="mt-6 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
                    {result.cv_holder.full_name ? (
                      <>
                        <dt className="font-medium text-[#787774] dark:text-zinc-500">Name</dt>
                        <dd className="text-[#2F3437] dark:text-zinc-200">{result.cv_holder.full_name}</dd>
                      </>
                    ) : null}
                    {result.cv_holder.current_role ? (
                      <>
                        <dt className="font-medium text-[#787774] dark:text-zinc-500">Current role</dt>
                        <dd className="text-[#2F3437] dark:text-zinc-200">{result.cv_holder.current_role}</dd>
                      </>
                    ) : null}
                    {result.cv_holder.department_or_field ? (
                      <>
                        <dt className="font-medium text-[#787774] dark:text-zinc-500">Field</dt>
                        <dd className="text-[#2F3437] dark:text-zinc-200">{result.cv_holder.department_or_field}</dd>
                      </>
                    ) : null}
                    {result.cv_holder.location ? (
                      <>
                        <dt className="font-medium text-[#787774] dark:text-zinc-500">Location</dt>
                        <dd className="text-[#2F3437] dark:text-zinc-200">{result.cv_holder.location}</dd>
                      </>
                    ) : null}
                    {result.cv_holder.email ? (
                      <>
                        <dt className="font-medium text-[#787774] dark:text-zinc-500">Email</dt>
                        <dd className="break-all font-mono text-[13px] text-[#2F3437] dark:text-zinc-200">
                          {result.cv_holder.email}
                        </dd>
                      </>
                    ) : null}
                  </dl>
                  {result.cv_holder.summary_line ? (
                    <p className="mt-8 border-t border-[#EAEAEA] pt-8 text-sm leading-[1.6] text-[#2F3437] dark:border-zinc-800 dark:text-zinc-300">
                      {result.cv_holder.summary_line}
                    </p>
                  ) : null}
                </section>
              ) : null}

              {result.detailed_report ? (
                <section className={cn(panel, "border-l-[3px] border-l-[#EAEAEA] bg-[#FBFBFA] p-6 dark:border-l-zinc-700 dark:bg-zinc-950/80 md:p-8")}>
                  <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#787774] dark:text-zinc-500">
                    Expert read
                  </h2>
                  <p className="mt-5 whitespace-pre-line text-sm leading-[1.6] text-[#2F3437] dark:text-zinc-300">
                    {result.detailed_report}
                  </p>
                </section>
              ) : null}
            </div>

            <section className={cn(panel, "p-6 md:p-8")}>
              <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#787774] dark:text-zinc-500">
                Category breakdown
              </h2>
              <ul className="mt-6">
                {Object.entries(result.category_scores).map(([key, score]) => {
                  const accent = scoreAccent(score);
                  return (
                    <li key={key} className="border-b border-[#EAEAEA] py-5 first:pt-0 last:border-b-0 dark:border-zinc-800">
                      <div className="flex items-baseline justify-between gap-4 text-sm">
                        <span className="font-medium capitalize text-[#2F3437] dark:text-zinc-200">
                          {key.replace(/_/g, " ")}
                        </span>
                        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-[#111111] dark:text-zinc-100">
                          {score}
                          <span className="font-sans font-normal text-[#787774] dark:text-zinc-500"> /100</span>
                        </span>
                      </div>
                      <div className="relative mt-2 h-1 overflow-hidden rounded-sm bg-[#EAEAEA] dark:bg-zinc-800">
                        <div
                          className={cn("absolute inset-y-0 left-0 rounded-sm", accent.bar)}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      {result.category_feedback?.[key] ? (
                        <p className="mt-3 text-sm leading-[1.6] text-[#787774] dark:text-zinc-400">
                          {result.category_feedback[key]}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <div className="grid gap-10 md:grid-cols-2">
            <section className={cn(panel, "p-6 md:p-8")}>
              <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#787774] dark:text-zinc-500">
                Strengths
              </h2>
              <ul className="mt-6 space-y-4">
                {result.strengths.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-[1.6] text-[#2F3437] dark:text-zinc-300">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#EDF3EC] dark:bg-[#1a2e1c]">
                      <CheckCircle className="h-3.5 w-3.5 text-[#346538] dark:text-[#a3c4a5]" weight="bold" aria-hidden />
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className={cn(panel, "p-6 md:p-8")}>
              <h2 className={labelMuted}>Improvements</h2>
              <ul className="mt-6 space-y-4">
                {result.improvements.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-[1.5] text-zinc-800 dark:text-zinc-300">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-[#FBF3DB] dark:bg-[#2d2610]">
                      <WarningCircle className="h-3.5 w-3.5 text-[#956400] dark:text-[#e8d48a]" weight="bold" aria-hidden />
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="rounded-[10px] border border-zinc-200/90 bg-[#F4F4F3] p-6 dark:border-zinc-800 dark:bg-zinc-900/50 md:p-8">
            <p className="text-center text-sm font-medium text-zinc-900 sm:text-left dark:text-zinc-100">Practice with Nova</p>
            <p
              className={cn(
                "mx-auto mt-2 max-w-[65ch] text-center text-sm leading-[1.5] sm:mx-0 sm:text-left",
                bodySecondary
              )}
            >
              Mock interview pulls from the same CV signals recruiters infer in a first pass.
            </p>
            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center md:justify-start">
              <Link href="/mock-interview" className="sm:inline-flex sm:justify-center">
                <Button variant="primary" icon={ArrowRight} iconPosition="right" className={cn("w-full sm:w-auto", ctaClass)}>
                  Start mock interview
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => setResult(null)}
                className="w-full rounded-[10px] border-zinc-200/90 shadow-none transition-colors duration-200 ease-out hover:bg-zinc-100/80 sm:w-auto dark:border-zinc-700 dark:hover:bg-zinc-800/60"
              >
                New analysis
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function CVAnalysisPage() {
  return (
    <Suspense fallback={<CVAnalysisPageSkeleton />}>
      <CVAnalysisContent />
    </Suspense>
  );
}
