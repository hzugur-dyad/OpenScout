import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeHiringScore,
  hiringScoreInputsFromInterviewRow,
} from "@/lib/hiring-score";
import { interviewScoreTrendFromChronological } from "@/lib/interview-history-trend";
import { parseInterviewLocale, type InterviewLocale } from "@/lib/interview-locale";
import { InterviewHistoryClientView } from "@/components/dashboard/InterviewHistoryClientView";

type InterviewRow = {
  id: string;
  job_category: string;
  created_at: string;
  score: number | null;
  report: unknown;
  interview_language: string | null;
};

function resultHref(row: InterviewRow): string {
  const locale: InterviewLocale = parseInterviewLocale(row.interview_language ?? undefined);
  const q = new URLSearchParams({ lang: locale });
  return `/mock-interview/${row.id}/result?${q.toString()}`;
}

export default async function InterviewHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
  if (profile?.role === "employer") redirect("/employer");

  const { data: rows } = await supabase
    .from("mock_interviews")
    .select("id, job_category, created_at, score, report, interview_language")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const interviews = (rows ?? []) as InterviewRow[];

  const lastFiveDesc = interviews.slice(0, 5);
  const lastFiveChronological = [...lastFiveDesc].reverse();
  const trendScores = lastFiveChronological.map((r) => (typeof r.score === "number" ? r.score : 0));
  const { trend, arrow } = interviewScoreTrendFromChronological(trendScores);

  const clientRows = interviews.map((r) => {
    const hiringScore = computeHiringScore(
      hiringScoreInputsFromInterviewRow({ interview_score: r.score, interview_report: r.report })
    );
    return {
      id: r.id,
      job_category: r.job_category,
      created_at: r.created_at,
      score: r.score,
      hiringScore,
      resultHref: resultHref(r),
    };
  });

  let bestInterviewScore = 0;
  let bestHiringScore = 0;
  for (const row of clientRows) {
    const overall = typeof row.score === "number" ? row.score : 0;
    if (overall > bestInterviewScore) bestInterviewScore = overall;
    if (row.hiringScore > bestHiringScore) bestHiringScore = row.hiringScore;
  }

  return (
    <InterviewHistoryClientView
      rows={clientRows}
      trendScores={trendScores}
      trend={trend}
      arrow={arrow}
      bestInterviewScore={bestInterviewScore}
      bestHiringScore={bestHiringScore}
    />
  );
}
