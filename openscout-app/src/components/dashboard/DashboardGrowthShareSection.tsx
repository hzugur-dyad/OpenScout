"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, ShareNetwork, UserPlus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { SharePublicProfileButton } from "@/components/dashboard/SharePublicProfileButton";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";
import { buildPublicInterviewResultPath, interviewResultViralText } from "@/lib/share-interview-result";
import { createClient } from "@/lib/supabase/client";

const easeOut = "ease-[cubic-bezier(0.33,1,0.68,1)]";
const cardClass = `rounded-[12px] border border-zinc-200/90 bg-[#FDFDFC] p-8 transition-[border-color,background-color] duration-200 ${easeOut} dark:border-zinc-800 dark:bg-zinc-900`;

type LatestInterview = {
  id: string;
  score: number | null;
  job_category: string | null;
};

export function DashboardGrowthShareSection() {
  const [loading, setLoading] = useState(true);
  const [latest, setLatest] = useState<LatestInterview | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setLatest(null);
          setLoading(false);
        }
        return;
      }
      const { data: row } = await supabase
        .from("mock_interviews")
        .select("id, score, job_category")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (!row?.id) {
        setLatest(null);
      } else {
        setLatest({
          id: row.id,
          score: typeof row.score === "number" ? row.score : null,
          job_category: typeof row.job_category === "string" ? row.job_category : null,
        });
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resultShare = useMemo(() => {
    if (!latest?.id) return null;
    const jobCategory = latest.job_category?.trim() || "practice";
    const score = typeof latest.score === "number" ? latest.score : 0;
    const path = buildPublicInterviewResultPath(latest.id);
    let fullUrl = path;
    if (typeof window !== "undefined") {
      const u = new URL(path, window.location.origin);
      u.searchParams.set("utm_source", "openscout");
      u.searchParams.set("utm_medium", "share");
      u.searchParams.set("utm_campaign", "dashboard_growth");
      fullUrl = u.href;
    }
    return { fullUrl, score, jobCategory, viral: interviewResultViralText(score, jobCategory) };
  }, [latest]);

  const [resultCopied, setResultCopied] = useState(false);

  const copyLatestResult = async () => {
    if (!resultShare) return;
    try {
      await navigator.clipboard.writeText(resultShare.fullUrl);
      trackClient(ANALYTICS_EVENTS.result_shared, {
        score: resultShare.score,
        job_category: resultShare.jobCategory,
        surface: "dashboard_growth",
      });
      setResultCopied(true);
      setTimeout(() => setResultCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const strongScore = typeof latest?.score === "number" && latest.score >= 70;

  if (loading) {
    return (
      <div className={cardClass} aria-busy="true">
        <div className="h-20 animate-pulse rounded-[10px] bg-zinc-900/[0.06] dark:bg-zinc-800" />
      </div>
    );
  }

  return (
    <section className={cardClass} aria-labelledby="dashboard-growth-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-[#E1F3FE] text-[#1F6C9F] dark:bg-[#1a2a35] dark:text-[#7eb8db]">
            <ShareNetwork className="h-6 w-6" weight="bold" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2
              id="dashboard-growth-heading"
              className="text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-100"
            >
              Share your progress
            </h2>
            <p className="mt-2 text-sm font-normal leading-[1.5] text-zinc-900/60 dark:text-zinc-400">
              Put verified interview signal in front of employers and friends—profile, latest
              scorecard, or an invite when someone is ready to practice.
            </p>
            {strongScore && (
              <p className="mt-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Strong run—your public link highlights this score without exposing your transcript.
              </p>
            )}
          </div>
        </div>
      </div>

      <ul className="mt-8 space-y-6">
        <li className="flex flex-col gap-3 border-t border-zinc-200/80 pt-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Public profile</p>
            <p className="mt-1 text-sm text-zinc-900/55 dark:text-zinc-500">
              One page with your Scout Score and hiring signal for intros and applications.
            </p>
          </div>
          <SharePublicProfileButton variant="outline" size="sm" surface="dashboard_growth" />
        </li>

        {resultShare && (
          <li className="flex flex-col gap-3 border-t border-zinc-200/80 pt-6 dark:border-zinc-800">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Latest interview result
                </p>
                <p className="mt-1 text-sm text-zinc-900/55 dark:text-zinc-500">
                  {resultShare.viral}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  icon={resultCopied ? Check : Copy}
                  iconPosition="left"
                  onClick={() => void copyLatestResult()}
                >
                  {resultCopied ? "Copied" : "Copy public link"}
                </Button>
                <Link
                  href={`/result/${encodeURIComponent(latest?.id ?? "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="outline" size="sm">
                    Preview
                  </Button>
                </Link>
              </div>
            </div>
          </li>
        )}

        <li className="flex flex-col gap-3 border-t border-zinc-200/80 pt-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Invite a friend</p>
            <p className="mt-1 text-sm text-zinc-900/55 dark:text-zinc-500">
              Bonus mock interviews when they qualify—details and your link below.
            </p>
          </div>
          <a
            href="#referral-program"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-zinc-200/90 bg-[#F5F4F2] px-4 text-sm font-semibold text-zinc-900 transition-[border-color,background-color,transform] duration-200 hover:border-zinc-300 hover:bg-[#EFEEEC] active:scale-[0.99] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
          >
            <UserPlus className="h-4 w-4" weight="bold" aria-hidden />
            Referral program
            <ArrowRight className="h-4 w-4" weight="bold" aria-hidden />
          </a>
        </li>
      </ul>
    </section>
  );
}
