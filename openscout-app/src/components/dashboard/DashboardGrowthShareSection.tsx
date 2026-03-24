"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ShareNetwork } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { SharePublicProfileButton } from "@/components/dashboard/SharePublicProfileButton";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";
import { buildPublicInterviewResultPath, interviewResultViralText } from "@/lib/share-interview-result";
import { createClient } from "@/lib/supabase/client";

const easeOut = "ease-[cubic-bezier(0.33,1,0.68,1)]";
const cardClass = `rounded-[12px] border border-zinc-200/90 bg-[#FDFDFC] p-6 transition-[border-color,background-color] duration-200 ${easeOut} dark:border-zinc-800 dark:bg-zinc-900`;

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

  if (loading) {
    return (
      <div className={cardClass} aria-busy="true">
        <div className="h-20 animate-pulse rounded-[10px] bg-zinc-900/[0.06] dark:bg-zinc-800" />
      </div>
    );
  }

  return (
    <section className={cardClass} aria-labelledby="dashboard-growth-heading">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#E1F3FE] text-[#1F6C9F] dark:bg-[#1a2a35] dark:text-[#7eb8db]">
            <ShareNetwork className="h-6 w-6" weight="bold" aria-hidden />
        </div>
        <h2
          id="dashboard-growth-heading"
          className="text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-100"
        >
          Share your progress
        </h2>
      </div>

      <ul className="mt-5 space-y-4">
        <li className="flex flex-col gap-2 border-t border-zinc-200/80 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Public profile</p>
          </div>
          <SharePublicProfileButton variant="outline" size="sm" surface="dashboard_growth" />
        </li>

        {resultShare && (
          <li className="flex flex-col gap-2 border-t border-zinc-200/80 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Latest result link</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <Button
                variant="primary"
                size="sm"
                icon={resultCopied ? Check : Copy}
                iconPosition="left"
                onClick={() => void copyLatestResult()}
              >
                {resultCopied ? "Copied" : "Copy latest result link"}
              </Button>
            </div>
          </li>
        )}
      </ul>
    </section>
  );
}
