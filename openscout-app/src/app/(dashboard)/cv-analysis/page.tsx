"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { motion } from "framer-motion";
import { JOB_TITLES } from "@/constants/jobFormOptions";
import { UsageBanner } from "@/components/dashboard/UsageBanner";

type CVHolder = {
  full_name: string;
  current_role: string;
  department_or_field: string;
  location: string;
  email: string;
  summary_line: string;
};

type AnalysisResult = {
  cv_holder?: CVHolder;
  overall_score: number;
  category_scores: Record<string, number>;
  category_feedback?: Record<string, string>;
  detailed_report?: string;
  strengths: string[];
  improvements: string[];
};

function CVAnalysisContent() {
  const searchParams = useSearchParams();
  const jobIdFromUrl = searchParams.get("jobId") ?? undefined;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const categoryFromUrl = searchParams.get("category");
  const initialCategory = categoryFromUrl && JOB_TITLES.includes(categoryFromUrl as (typeof JOB_TITLES)[number])
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
    return f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf") || f.name.toLowerCase().endsWith(".txt");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
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
  }, [isValidFile]);

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
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("jobCategory", jobCategory);
      if (jobIdFromUrl) formData.append("jobId", jobIdFromUrl);

      const res = await fetch("/api/cv-analysis", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error during analysis";
      setError(msg);
      console.error("CV analysis error:", e);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">CV Analysis</h1>
      <p className="mt-1 text-gray-500">
        Upload your CV, select job category, and let AI evaluate it.
      </p>

      <UsageBanner feature="cv_analysis" />

      {!result ? (
        <div className="mt-8 space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">Job Category</label>
            <CustomSelect
              options={JOB_TITLES}
              value={jobCategory}
              onChange={setJobCategory}
              aria-label="Job category"
            />
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-[10px] border-2 border-dashed p-12 transition-colors ${
              isDragging ? "border-primary bg-primary-muted/30" : "border-gray-300 bg-gray-50 dark:border-zinc-600 dark:bg-zinc-800"
            }`}
          >
            <Upload className="mb-4 h-12 w-12 text-gray-400 dark:text-zinc-500" />
            <p className="text-center text-sm text-gray-600 dark:text-zinc-300">
              Drag and drop your CV here or click to select
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">PDF or TXT only - max 10MB</p>
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
              onClick={() => fileInputRef.current?.click()}
            >
              Select File
            </Button>
            {file && (
              <p className="mt-4 text-sm text-gray-600">
                Selected: {file.name}
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {error}
            </div>
          )}

          <Button
            variant="primary"
            className="w-full"
            onClick={handleAnalyze}
            isLoading={isLoading}
          >
            Analyze
          </Button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 space-y-6"
        >
          {result.cv_holder && (result.cv_holder.full_name || result.cv_holder.current_role || result.cv_holder.summary_line) && (
            <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-zinc-100">CV summary</h3>
              <dl className="grid gap-2 text-sm sm:grid-cols-2 text-gray-700 dark:text-zinc-300">
                {result.cv_holder.full_name && (
                  <>
                    <dt className="font-medium text-gray-500 dark:text-zinc-500">Name</dt>
                    <dd>{result.cv_holder.full_name}</dd>
                  </>
                )}
                {result.cv_holder.current_role && (
                  <>
                    <dt className="font-medium text-gray-500 dark:text-zinc-500">Current role</dt>
                    <dd>{result.cv_holder.current_role}</dd>
                  </>
                )}
                {result.cv_holder.department_or_field && (
                  <>
                    <dt className="font-medium text-gray-500 dark:text-zinc-500">Department / field</dt>
                    <dd>{result.cv_holder.department_or_field}</dd>
                  </>
                )}
                {result.cv_holder.location && (
                  <>
                    <dt className="font-medium text-gray-500 dark:text-zinc-500">Location</dt>
                    <dd>{result.cv_holder.location}</dd>
                  </>
                )}
                {result.cv_holder.email && (
                  <>
                    <dt className="font-medium text-gray-500 dark:text-zinc-500">Email</dt>
                    <dd>{result.cv_holder.email}</dd>
                  </>
                )}
              </dl>
              {result.cv_holder.summary_line && (
                <p className="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-700 dark:border-zinc-700 dark:text-zinc-300">
                  {result.cv_holder.summary_line}
                </p>
              )}
            </div>
          )}

          {result.detailed_report && (
            <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
              <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-zinc-100">Expert assessment</h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-zinc-300">
                {result.detailed_report}
              </p>
            </div>
          )}

          <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white"
                style={{
                  backgroundColor:
                    result.overall_score >= 70
                      ? "#22c55e"
                      : result.overall_score >= 50
                      ? "var(--primary)"
                      : "#ef4444",
                }}
              >
                {result.overall_score}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Overall Score: {result.overall_score}/100</h2>
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  CV evaluation for {jobCategory}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Category scores and feedback</h3>
            <div className="mt-4 space-y-5">
              {Object.entries(result.category_scores).map(([key, score]) => (
                <div key={key} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0 dark:border-zinc-700">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize font-medium text-gray-800 dark:text-zinc-200">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-zinc-100">{score}/100</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-700">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${score}%`,
                        backgroundColor:
                          score >= 70
                            ? "#22c55e"
                            : score >= 50
                            ? "var(--primary)"
                            : "#ef4444",
                      }}
                    />
                  </div>
                  {result.category_feedback?.[key] && (
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">
                      {result.category_feedback[key]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Strengths</h3>
            <ul className="mt-3 space-y-2 text-gray-700 dark:text-zinc-300">
              {result.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500 dark:text-green-400" />
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Improvement Suggestions</h3>
            <ul className="mt-3 space-y-2 text-gray-700 dark:text-zinc-300">
              {result.improvements.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500 dark:text-amber-400" />
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <Button variant="outline" onClick={() => setResult(null)}>
            New Analysis
          </Button>
        </motion.div>
      )}
    </div>
  );
}

export default function CVAnalysisPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl p-8 text-center text-gray-500 dark:text-zinc-400">Loading…</div>}>
      <CVAnalysisContent />
    </Suspense>
  );
}
