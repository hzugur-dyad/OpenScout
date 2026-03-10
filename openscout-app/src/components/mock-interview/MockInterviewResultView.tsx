"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, AlertCircle, Share2, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ShareScoutScoreModal } from "@/components/dashboard/ShareScoutScoreModal";
import type { ScoutCredentialCreateBody, ScoutCredentialResponse } from "@/lib/types";

type Props = {
  tooShort: boolean;
  score: number;
  strengths: string[];
  improvements: string[];
  category: string;
  cvScore: number | null;
};

export function MockInterviewResultView({
  tooShort,
  score,
  strengths,
  improvements,
  category,
  cvScore,
}: Props) {
  const [passUrl, setPassUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  useEffect(() => {
    if (tooShort || !category) return;
    const report = { strengths, improvements };
    const body: ScoutCredentialCreateBody = {
      jobCategory: category,
      interviewScore: score,
      report,
    };
    if (cvScore != null && !Number.isNaN(cvScore)) body.cvScore = cvScore;
    fetch("/api/scout-credential", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ScoutCredentialResponse | null) => data?.passUrl && setPassUrl(data.passUrl))
      .catch(() => {});
  }, [tooShort, category, score, strengths, improvements, cvScore]);

  const handleCopyPassUrl = () => {
    if (!passUrl) return;
    navigator.clipboard.writeText(passUrl).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Interview Result</h1>
      <p className="mt-1 text-gray-500 dark:text-zinc-400">
        {tooShort ? "The interview was too short to analyze." : "Your AI evaluation is ready."}
      </p>

      {tooShort ? (
        <div className="mt-8 rounded-[10px] border border-amber-200 bg-amber-50 p-8 shadow-card dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-center text-amber-800 dark:text-amber-200">
            The interview was shorter than 5 minutes, so it could not be analyzed. Please try again with a longer conversation to receive feedback and a score.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 rounded-[10px] border border-[var(--border)] bg-white p-8 shadow-card dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-center gap-6">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white"
                style={{
                  backgroundColor:
                    score >= 70 ? "#22c55e" : score >= 50 ? "var(--primary)" : "#ef4444",
                }}
              >
                {score}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Overall Score: {score}/100</h2>
                <p className="text-sm text-gray-500 dark:text-zinc-400">Your interview performance</p>
              </div>
            </div>
          </div>

          {passUrl && (
            <div className="mt-6 rounded-[10px] border-2 border-[var(--primary)] bg-[var(--primary-lighter)]/30 p-6 shadow-card dark:bg-primary-muted/30">
              <div className="flex items-center gap-2">
                <Share2 className="h-5 w-5" style={{ color: "var(--primary-dark)" }} />
                <h3 className="font-semibold" style={{ color: "var(--primary-dark)" }}>Share your Scout Score</h3>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-zinc-300">
                One credential, many companies. Share this link so employers can see your AI-verified score and report.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  readOnly
                  value={passUrl}
                  className="flex-1 min-w-0 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <Button
                  variant="primary"
                  size="sm"
                  icon={Copy}
                  iconPosition="left"
                  onClick={handleCopyPassUrl}
                >
                  {shareCopied ? "Copied!" : "Copy link"}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setShareModalOpen(true)}>
                  Share on LinkedIn / X
                </Button>
                <Link href={passUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">View pass</Button>
                </Link>
              </div>
              {shareModalOpen && (
                <ShareScoutScoreModal passUrl={passUrl} onClose={() => setShareModalOpen(false)} />
              )}
            </div>
          )}

          <div className="mt-6 rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Strengths</h3>
            <ul className="mt-3 space-y-2 text-gray-700 dark:text-zinc-300">
              {strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500 dark:text-green-400" />
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Improvement Suggestions</h3>
            <ul className="mt-3 space-y-2 text-gray-700 dark:text-zinc-300">
              {improvements.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500 dark:text-amber-400" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div className="mt-8 flex gap-4">
        <Link href="/mock-interview">
          <Button variant="outline">New Interview</Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="primary">Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
