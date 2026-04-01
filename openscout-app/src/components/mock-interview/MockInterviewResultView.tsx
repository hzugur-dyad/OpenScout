"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle,
  Copy,
  ShareNetwork,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { ShareScoutScoreModal } from "@/components/dashboard/ShareScoutScoreModal";
import { InterviewResultShareBlock } from "@/components/mock-interview/InterviewResultShareBlock";
import { SocialCardSharePanel } from "@/components/share/SocialCardSharePanel";
import { InterviewResultCard } from "@/components/share/SocialCards";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";
import type { ScoutCredentialCreateBody, ScoutCredentialResponse } from "@/lib/types";
import { interviewUi, type InterviewLocale } from "@/lib/interview-locale";
import { useCountUp } from "@/hooks/useCountUp";

type Props = {
  tooShort: boolean;
  score: number;
  strengths: string[];
  improvements: string[];
  category: string;
  cvScore: number | null;
  locale?: InterviewLocale;
  justification?: string | null;
  technicalScore?: number | null;
  communicationScore?: number | null;
  problemSolvingScore?: number | null;
  /** When set, shows public `/result/[id]` share card (no transcript on shared link). */
  shareResultId?: string;
  /** Set when redirect follows a successful job application submit from the interview flow. */
  applicationSubmitted?: boolean;
  firstName?: string;
};

function DimensionMeter({ label, value }: { label: string; value: number }) {
  const n = useCountUp(value, 1300);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm text-gray-700 dark:text-zinc-300">
        <span>{label}</span>
        <span className="font-semibold tabular-nums text-gray-900 dark:text-zinc-100">{n}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: "var(--primary)" }}
          initial={{ width: 0 }}
          animate={{ width: `${n}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export function MockInterviewResultView({
  tooShort,
  score,
  strengths,
  improvements,
  category,
  cvScore,
  locale: _localeProp,
  justification,
  technicalScore,
  communicationScore,
  problemSolvingScore,
  shareResultId,
  applicationSubmitted = false,
  firstName,
}: Props) {
  const ui = interviewUi.en;
  const [passUrl, setPassUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const displayOverall = useCountUp(tooShort ? 0 : score, 1600, !tooShort);

  const hasDimensions =
    technicalScore != null || communicationScore != null || problemSolvingScore != null;

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
      trackClient(ANALYTICS_EVENTS.scout_pass_shared, {
        channel: "copy_link",
        surface: "interview_result",
      });
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  };

  const circleColor =
    score >= 70 ? "#22c55e" : score >= 50 ? "var(--primary)" : "#ef4444";
  const interviewEvaluationLine =
    score >= 80 ? "Strong interview signal" : score >= 60 ? "Solid readiness signal" : "Room to improve";

  return (
    <div className="mx-auto max-w-2xl">
      <p className="os-eyebrow">Mock interview</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-3xl">
        {ui.resultTitle}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {tooShort ? ui.resultTooShortLead : ui.resultReadyLead}
      </p>

      {tooShort ? (
        <div className="mt-8 rounded-[10px] border border-amber-200 bg-amber-50 p-8 shadow-card dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-center text-amber-800 dark:text-amber-200">{ui.resultTooShortBox}</p>
        </div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="os-surface-card mt-8 p-8 md:p-10"
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
              <motion.div
                initial={{ scale: 0.88, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.05 }}
                className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-3xl font-bold text-white tabular-nums"
                style={{ backgroundColor: circleColor }}
              >
                {displayOverall}
              </motion.div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">
                  {ui.overallScore}: {displayOverall}/100
                </h2>
                <p className="text-sm text-gray-500 dark:text-zinc-400">{ui.performanceSubtitle}</p>

                {hasDimensions && (
                  <div className="mt-5 space-y-4 border-t border-zinc-100 pt-5 dark:border-zinc-800">
                    {technicalScore != null && (
                      <DimensionMeter label={ui.scoreTechnical} value={technicalScore} />
                    )}
                    {communicationScore != null && (
                      <DimensionMeter label={ui.scoreCommunication} value={communicationScore} />
                    )}
                    {problemSolvingScore != null && (
                      <DimensionMeter label={ui.scoreProblemSolving} value={problemSolvingScore} />
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {shareResultId?.trim() && (
            <div className="mt-6 space-y-3">
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {ui.shareResultLead}
              </p>
              <InterviewResultShareBlock
                resultId={shareResultId.trim()}
                score={score}
                jobCategory={category}
                surface="interview_result"
              />
            </div>
          )}

          <div className="mt-6">
            <SocialCardSharePanel
              title="Share card"
              fileName={`openscout-interview-${shareResultId?.trim() || "result"}`}
              shareText={`My OpenScout interview score: ${score}/100`}
            >
              <InterviewResultCard
                role={category?.trim() || "General"}
                score={score}
                evaluationLine={interviewEvaluationLine}
                firstName={firstName}
              />
            </SocialCardSharePanel>
          </div>

          {justification?.trim() && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
              className="os-surface-card mt-6 p-6 md:p-8"
            >
              <div
                className="flex items-start gap-3 rounded-lg px-1"
                style={{
                  background: "linear-gradient(135deg, var(--primary-lighter) 0%, transparent 55%)",
                }}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--primary-muted)" }}
                >
                  <Sparkle className="h-5 w-5" style={{ color: "var(--primary-dark)" }} weight="regular" aria-hidden />
                </div>
                <div className="min-w-0 py-1">
                  <h3 className="font-semibold text-gray-900 dark:text-zinc-100">{ui.aiFeedbackTitle}</h3>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{ui.aiFeedbackSubtitle}</p>
                  <p className="mt-3 text-sm leading-relaxed text-gray-800 dark:text-zinc-200">
                    {justification.trim()}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {passUrl && (
            <div className="os-surface-card mt-6 border-2 border-primary/35 bg-[var(--primary-lighter)]/25 p-6 dark:border-primary/40 dark:bg-primary-muted/25 md:p-8">
              <div className="flex items-center gap-2">
                <ShareNetwork className="h-5 w-5" style={{ color: "var(--primary-dark)" }} weight="regular" aria-hidden />
                <h3 className="font-semibold" style={{ color: "var(--primary-dark)" }}>
                  {ui.shareScoutTitle}
                </h3>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-zinc-300">{ui.shareScoutBody}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  readOnly
                  value={passUrl}
                  className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <Button
                  variant="primary"
                  size="sm"
                  icon={Copy}
                  iconPosition="left"
                  onClick={handleCopyPassUrl}
                >
                  {shareCopied ? ui.copied : ui.copyLink}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setShareModalOpen(true)}>
                  {ui.shareSocial}
                </Button>
                <Link href={passUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">
                    {ui.viewPass}
                  </Button>
                </Link>
              </div>
              {shareModalOpen && (
                <ShareScoutScoreModal passUrl={passUrl} onClose={() => setShareModalOpen(false)} />
              )}
            </div>
          )}

          <div className="os-surface-card mt-6 p-6 md:p-8">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{ui.strengths}</h3>
            <ul className="mt-3 space-y-2 text-gray-700 dark:text-zinc-300">
              {strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500 dark:text-green-400" weight="regular" aria-hidden />
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="os-surface-card mt-6 p-6 md:p-8">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{ui.improvements}</h3>
            <ul className="mt-3 space-y-2 text-gray-700 dark:text-zinc-300">
              {improvements.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <WarningCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500 dark:text-amber-400" weight="regular" aria-hidden />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {!tooShort && applicationSubmitted && (
        <div className="mt-8 rounded-[10px] border border-green-200 bg-green-50/80 p-4 dark:border-green-900/50 dark:bg-green-950/30">
          <p className="text-sm font-medium text-green-900 dark:text-green-100">{ui.applicationSubmittedLead}</p>
          <p className="mt-1 text-sm text-green-800/90 dark:text-green-200/90">{ui.applicationSubmittedNext}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/dashboard/applications">
              <Button variant="primary" size="sm">
                {ui.myApplicationsCta}
              </Button>
            </Link>
            <Link href="/dashboard/jobs">
              <Button variant="outline" size="sm">
                {ui.browseMoreJobsCta}
              </Button>
            </Link>
          </div>
        </div>
      )}

      {!tooShort && !applicationSubmitted && (
        <p className="mt-8 text-sm text-gray-600 dark:text-zinc-400">{ui.nextAfterInterviewLine}</p>
      )}

      <div className={`flex flex-wrap gap-4 ${!tooShort ? "mt-3" : "mt-8"}`}>
        <Link href="/dashboard/jobs">
          <Button variant="primary">{ui.applyToJobsCta}</Button>
        </Link>
        <Link href="/mock-interview">
          <Button variant="outline">{ui.takeAnotherInterviewCta}</Button>
        </Link>
      </div>
    </div>
  );
}
