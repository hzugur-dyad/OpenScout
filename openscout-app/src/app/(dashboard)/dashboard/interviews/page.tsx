import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  computeHiringScore,
  hiringScoreInputsFromInterviewRow,
} from "@/lib/hiring-score";
import { interviewScoreTrendFromChronological } from "@/lib/interview-history-trend";
import { parseInterviewLocale, type InterviewLocale } from "@/lib/interview-locale";
import { SharePublicProfileButton } from "@/components/dashboard/SharePublicProfileButton";

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

  let bestInterviewScore = 0;
  let bestHiringScore = 0;
  for (const r of interviews) {
    const overall = typeof r.score === "number" ? r.score : 0;
    if (overall > bestInterviewScore) bestInterviewScore = overall;
    const hs = computeHiringScore(
      hiringScoreInputsFromInterviewRow({ interview_score: r.score, interview_report: r.report })
    );
    if (hs > bestHiringScore) bestHiringScore = hs;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Interview history</h1>
          <p className="mt-1 text-gray-500 dark:text-zinc-400">Past mock interviews and how you&apos;re trending.</p>
        </div>
        <SharePublicProfileButton />
      </div>

      {interviews.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={MessageCircle}
          title="No interviews yet"
          description="Complete a mock interview to see scores, trends, and history here."
        >
          <Link href="/mock-interview">
            <Button variant="primary">Start your first interview</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        </EmptyState>
      ) : (
        <>
          <div className="mt-8 space-y-4 rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Performance</h2>
            <p className="text-sm text-gray-600 dark:text-zinc-400">
              Recent overall scores (oldest → newest, up to 5):{" "}
              <span className="font-medium tabular-nums text-gray-900 dark:text-zinc-100">
                {trendScores.join(", ")}
              </span>
            </p>
            <p className="text-sm text-gray-700 dark:text-zinc-300">
              Trend:{" "}
              <span className="font-semibold">
                {trend} {arrow}
              </span>
            </p>
            <div className="flex flex-wrap gap-6 border-t border-[var(--border)] pt-4 text-sm dark:border-zinc-700">
              <div>
                <span className="text-gray-500 dark:text-zinc-500">Best interview score</span>
                <p className="text-lg font-semibold tabular-nums text-gray-900 dark:text-zinc-100">
                  {bestInterviewScore}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-zinc-500">Best hiring score</span>
                <p className="text-lg font-semibold tabular-nums text-gray-900 dark:text-zinc-100">
                  {bestHiringScore}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-[10px] border border-[var(--border)] bg-white shadow-soft dark:border-zinc-700 dark:bg-zinc-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Role / category</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Date</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Overall</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Hiring score</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Result</th>
                </tr>
              </thead>
              <tbody>
                {interviews.map((r) => {
                  const hiringScore = computeHiringScore(
                    hiringScoreInputsFromInterviewRow({
                      interview_score: r.score,
                      interview_report: r.report,
                    })
                  );
                  const overall = typeof r.score === "number" ? r.score : "—";
                  return (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-b-0 dark:border-zinc-700">
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-zinc-200">{r.job_category}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-zinc-400">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-800 dark:text-zinc-200">{overall}</td>
                      <td className="px-4 py-3 tabular-nums text-gray-800 dark:text-zinc-200">{hiringScore}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={resultHref(r)}
                          className="font-medium text-[var(--primary-dark)] hover:underline dark:text-[var(--primary)]"
                        >
                          View result
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
