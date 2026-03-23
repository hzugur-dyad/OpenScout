"use client";

import { useMemo, useState } from "react";
import { Check, Copy, ShareNetwork } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";
import {
  buildPublicInterviewResultPath,
  interviewResultViralText,
} from "@/lib/share-interview-result";

type Props = {
  resultId: string;
  score: number;
  jobCategory: string;
  showAnonToggle?: boolean;
  /** PostHog funnel slice: e.g. interview_result | public_result_page | dashboard_growth */
  surface?: string;
};

function trackShare(score: number, job_category: string, surface?: string) {
  trackClient(ANALYTICS_EVENTS.result_shared, {
    score,
    job_category,
    ...(surface ? { surface } : {}),
  });
}

export function InterviewResultShareBlock({
  resultId,
  score,
  jobCategory,
  showAnonToggle = true,
  surface,
}: Props) {
  const [hideName, setHideName] = useState(false);
  const [copied, setCopied] = useState(false);

  const publicPath = useMemo(
    () => buildPublicInterviewResultPath(resultId, { anon: hideName }),
    [resultId, hideName]
  );

  const fullUrl = useMemo(() => {
    if (typeof window === "undefined") return publicPath;
    const u = new URL(publicPath, window.location.origin);
    u.searchParams.set("utm_source", "openscout");
    u.searchParams.set("utm_medium", "share");
    u.searchParams.set("utm_campaign", "interview_result");
    return u.href;
  }, [publicPath]);

  const viralText = interviewResultViralText(score, jobCategory);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      trackShare(score, jobCategory, surface);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const nativeShare = async () => {
    const shareData: ShareData = {
      title: "My OpenScout interview result",
      text: `${viralText} ${fullUrl}`,
      url: fullUrl,
    };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(shareData);
        trackShare(score, jobCategory, surface);
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        /* ignore */
      }
    }
  };

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card dark:border-white/[0.12] dark:bg-black/25 dark:backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <ShareNetwork className="h-5 w-5 text-gray-600 dark:text-zinc-400" weight="regular" aria-hidden />
        <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Share this result</h3>
      </div>
      <p className="mt-2 text-sm text-gray-600 dark:text-zinc-300">
        Show interview readiness with a public scorecard—strengths and improvements only. Your
        transcript and account stay private.
      </p>
      <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-gray-800 dark:bg-black/20 dark:text-zinc-200">
        {viralText}
      </p>
      {showAnonToggle && (
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-gray-700 dark:text-zinc-300">
          <input
            type="checkbox"
            className="mt-1 rounded border-[var(--border)]"
            checked={hideName}
            onChange={(e) => setHideName(e.target.checked)}
          />
          <span>Hide my first name on the public page (?anon=1)</span>
        </label>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          readOnly
          value={fullUrl}
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm dark:border-white/[0.18] dark:bg-black/30 dark:text-zinc-100"
        />
        <Button
          variant="primary"
          size="sm"
          icon={copied ? Check : Copy}
          iconPosition="left"
          onClick={() => void copyLink()}
        >
          {copied ? "Copied" : "Copy link"}
        </Button>
        {canNativeShare && (
          <Button variant="outline" size="sm" onClick={() => void nativeShare()}>
            Share sheet…
          </Button>
        )}
      </div>
    </div>
  );
}
