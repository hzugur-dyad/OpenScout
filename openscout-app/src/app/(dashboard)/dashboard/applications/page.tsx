import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Briefcase, MessageCircle } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CandidateApplicationStatusBadge } from "@/components/candidate/CandidateApplicationStatusBadge";
import { CandidateApplicationsFilters } from "@/components/candidate/CandidateApplicationsFilters";
import {
  applicationHiringScore,
  filterCandidateApplications,
  parseCandidateApplicationsQuery,
  sortCandidateApplications,
  type CandidateApplicationRow,
} from "@/lib/candidate-applications-list";
import { parseInterviewLocale, type InterviewLocale } from "@/lib/interview-locale";

function companyNameFromJob(job: CandidateApplicationRow["job_listings"]): string {
  const c = job?.companies;
  if (!c) return "—";
  if (Array.isArray(c)) return (c[0] as { name?: string })?.name ?? "—";
  return (c as { name: string }).name;
}

function interviewResultHref(
  sessionId: string | undefined,
  lang: string | null | undefined
): string | null {
  if (!sessionId) return null;
  const locale: InterviewLocale = parseInterviewLocale(lang ?? undefined);
  const q = new URLSearchParams({ lang: locale });
  return `/mock-interview/${sessionId}/result?${q.toString()}`;
}

async function latestInterviewByJob(
  supabase: SupabaseClient,
  userId: string,
  jobIds: string[]
): Promise<Map<string, { id: string; interview_language: string | null }>> {
  const map = new Map<string, { id: string; interview_language: string | null }>();
  if (jobIds.length === 0) return map;

  const { data } = await supabase
    .from("mock_interviews")
    .select("id, job_id, interview_language, created_at")
    .eq("user_id", userId)
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });

  for (const row of data ?? []) {
    const jid = row.job_id as string;
    if (!map.has(jid)) {
      map.set(jid, {
        id: row.id as string,
        interview_language: (row.interview_language as string | null) ?? null,
      });
    }
  }
  return map;
}

export default async function CandidateApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { sort, status } = parseCandidateApplicationsQuery(sp);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
  if (profile?.role === "employer") redirect("/employer");

  const { data: rawRows } = await supabase
    .from("job_applications")
    .select(
      `
      id,
      job_id,
      created_at,
      application_status,
      cv_score,
      interview_score,
      interview_report,
      job_listings (
        id,
        title,
        companies ( name )
      )
    `
    )
    .eq("user_id", user.id);

  const rawList = rawRows ?? [];
  const rows: CandidateApplicationRow[] = rawList.map((row) => {
    const jl = row.job_listings as unknown;
    const job_listings = Array.isArray(jl) ? (jl[0] as CandidateApplicationRow["job_listings"]) : (jl as CandidateApplicationRow["job_listings"]);
    return {
      id: row.id as string,
      job_id: row.job_id as string,
      created_at: row.created_at as string,
      application_status: (row.application_status as string) ?? "applied",
      cv_score: row.cv_score as number | null,
      interview_score: row.interview_score as number | null,
      interview_report: row.interview_report,
      job_listings,
    };
  });
  const jobIds = [...new Set(rows.map((r) => r.job_id).filter(Boolean))];
  const interviewByJob = await latestInterviewByJob(supabase, user.id, jobIds);

  const filtered = filterCandidateApplications(rows, status);
  const applications = sortCandidateApplications(filtered, sort);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Applications</h1>
      <p className="mt-1 text-gray-500 dark:text-zinc-400">
        Jobs you&apos;ve applied to and your latest scores.
      </p>
      <p className="mt-2 text-xs text-gray-500 dark:text-zinc-500">
        Status uses the employer pipeline: &quot;Applied&quot; means submitted and may still be in review; employers
        move you to Shortlisted or Rejected.
      </p>

      <div className="mt-6">
        <Suspense
          fallback={<div className="h-24 animate-pulse rounded-[10px] bg-gray-100 dark:bg-zinc-800" />}
        >
          <CandidateApplicationsFilters />
        </Suspense>
      </div>

      {applications.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={Briefcase}
          title={rows.length === 0 ? "No applications yet" : "No matches for this filter"}
          description={
            rows.length === 0
              ? "Apply to a job listing after your CV analysis and mock interview meet the requirements."
              : "Try another status filter or reset to see all applications."
          }
        >
          {rows.length === 0 ? (
            <>
              <Link href="/dashboard/jobs">
                <Button variant="primary" icon={Briefcase} iconPosition="left">
                  Browse jobs
                </Button>
              </Link>
              <Link href="/mock-interview">
                <Button variant="outline" icon={MessageCircle} iconPosition="left">
                  Take an interview
                </Button>
              </Link>
            </>
          ) : (
            <Link href="/dashboard/applications">
              <Button variant="primary">Show all</Button>
            </Link>
          )}
        </EmptyState>
      ) : (
        <div className="mt-8 overflow-hidden rounded-[10px] border border-[var(--border)] bg-white shadow-soft dark:border-zinc-700 dark:bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Job</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Applied</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">CV</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Interview</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Hiring</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((r) => {
                const job = r.job_listings;
                const title = job?.title ?? "Job";
                const company = companyNameFromJob(job);
                const hiring = applicationHiringScore(r);
                const pipeline = r.application_status || "applied";
                const mi = interviewByJob.get(r.job_id);
                const resultHref = interviewResultHref(mi?.id, mi?.interview_language);

                return (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-b-0 dark:border-zinc-700">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-zinc-100">{title}</div>
                      <div className="text-xs text-gray-500 dark:text-zinc-400">{company}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-zinc-400">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <CandidateApplicationStatusBadge applicationStatus={pipeline} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-800 dark:text-zinc-200">
                      {typeof r.cv_score === "number" ? r.cv_score : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-800 dark:text-zinc-200">
                      {typeof r.interview_score === "number" ? r.interview_score : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-800 dark:text-zinc-200">{hiring}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/dashboard/jobs/${r.job_id}`}
                          className="font-medium text-[var(--primary-dark)] hover:underline dark:text-[var(--primary)]"
                        >
                          Job
                        </Link>
                        <Link
                          href={`/dashboard/applications/${r.id}`}
                          className="text-xs font-medium text-gray-600 hover:underline dark:text-zinc-400"
                        >
                          Details
                        </Link>
                        {resultHref && (
                          <Link
                            href={resultHref}
                            className="text-xs font-medium text-[var(--primary-dark)] hover:underline dark:text-[var(--primary)]"
                          >
                            Interview result
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
