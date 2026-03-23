import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Newsreader } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import {
  RscArrowSquareOutIcon,
  RscChatCircleIcon,
  RscFileMagnifyingGlassIcon,
} from "@/components/icons/PhosphorRscIcons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CandidateApplicationStatusBadge } from "@/components/candidate/CandidateApplicationStatusBadge";
import { CandidateApplicationsFilters } from "@/components/candidate/CandidateApplicationsFilters";
import { MinimalSection } from "@/components/candidate/MinimalSection";
import {
  applicationHiringScore,
  filterCandidateApplications,
  parseCandidateApplicationsQuery,
  sortCandidateApplications,
  type CandidateApplicationRow,
} from "@/lib/candidate-applications-list";
import { parseInterviewLocale, type InterviewLocale } from "@/lib/interview-locale";

const applicationsSerif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600"],
});

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

  const total = rows.length;
  const inReview = rows.filter((r) => (r.application_status || "applied") === "applied").length;
  const shortlisted = rows.filter((r) => r.application_status === "shortlisted").length;
  const rejected = rows.filter((r) => r.application_status === "rejected").length;
  const showing = applications.length;
  const isFiltered = showing !== total && total > 0;

  const editorialEase = "[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]";
  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBFBFA] dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900";
  const actionLinkClass = `inline-flex min-h-11 w-full cursor-pointer touch-manipulation items-center gap-2 rounded-[10px] px-1 -mx-1 py-2 text-sm font-medium text-[#111] transition-[transform,opacity,color] duration-200 ${editorialEase} hover:bg-black/[0.03] hover:text-[#111] hover:no-underline active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 dark:text-zinc-100 dark:hover:bg-white/[0.04] ${focusRing}`;
  const actionMutedClass = `inline-flex min-h-11 w-full cursor-pointer touch-manipulation items-center gap-2 rounded-[10px] px-1 -mx-1 py-2 text-sm font-medium text-[#787774] transition-[transform,opacity,color,background-color] duration-200 ${editorialEase} hover:bg-black/[0.03] hover:text-[#2F3437] hover:no-underline active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 dark:text-zinc-500 dark:hover:bg-white/[0.04] dark:hover:text-zinc-300 ${focusRing}`;
  const actionLinkClassTable = `inline-flex min-h-11 w-max max-w-full cursor-pointer touch-manipulation items-center gap-1.5 rounded-[10px] px-1 -mx-1 py-2 text-sm font-medium text-[#111] transition-[transform,opacity,color,background-color] duration-200 ${editorialEase} hover:bg-black/[0.03] hover:text-[#111] hover:no-underline active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 dark:text-zinc-100 dark:hover:bg-white/[0.04] ${focusRing}`;
  const actionMutedClassTable = `inline-flex min-h-11 w-max max-w-full cursor-pointer touch-manipulation items-center gap-1.5 rounded-[10px] px-1 -mx-1 py-2 text-sm font-medium text-[#787774] transition-[transform,opacity,color,background-color] duration-200 ${editorialEase} hover:bg-black/[0.03] hover:text-[#2F3437] hover:no-underline active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 dark:text-zinc-500 dark:hover:bg-white/[0.04] dark:hover:text-zinc-300 ${focusRing}`;

  return (
    <div className="relative -mx-4 min-h-full bg-[#F7F6F3] px-4 py-10 pb-24 lg:-mx-8 lg:px-8 dark:bg-transparent">
      <main
        id="applications-main"
        aria-labelledby="applications-heading"
        className="relative mx-auto w-full max-w-5xl"
      >
        <MinimalSection>
          <header className="grid gap-8 pb-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-14">
            <div className="min-w-0">
              <h1
                id="applications-heading"
                className={`${applicationsSerif.className} text-[2rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[#111] md:text-[2.35rem] dark:text-zinc-50`}
              >
                Applications
              </h1>
              <p className="mt-4 max-w-[65ch] text-base font-normal leading-[1.5] text-[#2F3437] dark:text-zinc-300">
                Roles you have submitted to, with CV and interview scores where the employer has recorded them.
              </p>
              <p className="mt-3 max-w-[65ch] text-sm font-normal leading-[1.5] text-[#787774] dark:text-zinc-500">
                Status follows the employer pipeline. &quot;Applied&quot; means your file is in review; employers move you
                to Shortlisted or Rejected.
              </p>
            </div>
            {total > 0 && (
              <div className="flex flex-col gap-4 lg:items-end">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#787774] dark:text-zinc-500">
                  Overview
                </p>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4 lg:flex lg:flex-wrap lg:justify-end lg:gap-x-10">
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs font-normal text-[#787774] dark:text-zinc-500">Total</dt>
                    <dd className="font-mono text-lg font-medium tabular-nums tracking-tight text-[#111] dark:text-zinc-100">
                      {total}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs font-normal text-[#787774] dark:text-zinc-500">In review</dt>
                    <dd className="font-mono text-lg font-medium tabular-nums tracking-tight text-[#111] dark:text-zinc-100">
                      {inReview}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs font-normal text-[#787774] dark:text-zinc-500">Shortlisted</dt>
                    <dd className="font-mono text-lg font-medium tabular-nums tracking-tight text-[#111] dark:text-zinc-100">
                      {shortlisted}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs font-normal text-[#787774] dark:text-zinc-500">Rejected</dt>
                    <dd className="font-mono text-lg font-medium tabular-nums tracking-tight text-[#111] dark:text-zinc-100">
                      {rejected}
                    </dd>
                  </div>
                </dl>
                {isFiltered && (
                  <p className="text-sm text-[#2F3437] dark:text-zinc-400">
                    Showing{" "}
                    <span className="font-mono tabular-nums text-[#111] dark:text-zinc-100">{showing}</span> of{" "}
                    <span className="font-mono tabular-nums text-[#111] dark:text-zinc-100">{total}</span>
                  </p>
                )}
              </div>
            )}
          </header>
        </MinimalSection>

        <MinimalSection className="mt-10" delay={0.08}>
          <Suspense
            fallback={
              <div
                className="grid animate-pulse grid-cols-1 gap-6 rounded-xl border border-[#E6E5E2] bg-[#FBFBFA] p-8 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900"
                aria-hidden
              >
                <div className="flex flex-col gap-2">
                  <div className="h-3 w-14 rounded-sm bg-[#E8E7E4] dark:bg-zinc-800" />
                  <div className="h-11 w-full rounded-[10px] bg-[#F0EFEC] dark:bg-zinc-800/80" />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="h-3 w-10 rounded-sm bg-[#E8E7E4] dark:bg-zinc-800" />
                  <div className="h-11 w-full rounded-[10px] bg-[#F0EFEC] dark:bg-zinc-800/80" />
                </div>
              </div>
            }
          >
            <div className="rounded-xl border border-[#EAEAEA] bg-[#FFFFFF] p-8 dark:border-zinc-800 dark:bg-zinc-900">
              <CandidateApplicationsFilters className="lg:max-w-none" />
            </div>
          </Suspense>
        </MinimalSection>

        {applications.length === 0 ? (
          <MinimalSection className="mt-12" delay={0.16}>
            <EmptyState
              className="border-[#E6E5E2] bg-[#FBFBFA] dark:border-zinc-800 dark:bg-zinc-900"
              iconName="briefcase"
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
                    <Button variant="primary">Browse jobs</Button>
                  </Link>
                  <Link href="/mock-interview">
                    <Button variant="outline">Start mock interview</Button>
                  </Link>
                </>
              ) : (
                <Link href="/dashboard/applications">
                  <Button variant="primary">Show all</Button>
                </Link>
              )}
            </EmptyState>
          </MinimalSection>
        ) : (
          <MinimalSection className="mt-12" delay={0.16}>
            <div className="space-y-4 md:hidden">
            {applications.map((r) => {
              const job = r.job_listings;
              const title = job?.title ?? "Job";
              const company = companyNameFromJob(job);
              const hiring = applicationHiringScore(r);
              const pipeline = r.application_status || "applied";
              const mi = interviewByJob.get(r.job_id);
              const resultHref = interviewResultHref(mi?.id, mi?.interview_language);
              const applied = r.created_at ? new Date(r.created_at).toLocaleDateString() : "—";

              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-[#E6E5E2] bg-[#FBFBFA] p-6 transition-[border-color,transform] duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none hover:border-[#D4D3CF] active:scale-[0.99] motion-reduce:active:scale-100 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold leading-snug text-[#111] dark:text-zinc-100">{title}</h2>
                      <p className="mt-1 text-sm font-normal text-[#787774] dark:text-zinc-400">{company}</p>
                    </div>
                    <CandidateApplicationStatusBadge applicationStatus={pipeline} />
                  </div>
                  <p className="mt-4 text-xs font-normal text-[#787774] dark:text-zinc-500">Applied {applied}</p>
                  <div className="mt-6 grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#787774] dark:text-zinc-500">
                        CV
                      </p>
                      <p className="mt-0.5 font-mono text-sm tabular-nums text-[#111] dark:text-zinc-100">
                        {typeof r.cv_score === "number" ? r.cv_score : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#787774] dark:text-zinc-500">
                        Interview
                      </p>
                      <p className="mt-0.5 font-mono text-sm tabular-nums text-[#111] dark:text-zinc-100">
                        {typeof r.interview_score === "number" ? r.interview_score : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#787774] dark:text-zinc-500">
                        Hiring
                      </p>
                      <p className="mt-0.5 font-mono text-sm tabular-nums text-[#111] dark:text-zinc-100">{hiring}</p>
                    </div>
                  </div>
                  <div className="mt-6 flex flex-col gap-1">
                    <Link href={`/dashboard/jobs/${r.job_id}`} className={actionLinkClass}>
                      <RscArrowSquareOutIcon className="h-4 w-4 shrink-0" />
                      Open listing
                    </Link>
                    <Link href={`/dashboard/applications/${r.id}`} className={actionMutedClass}>
                      <RscFileMagnifyingGlassIcon className="h-4 w-4 shrink-0" />
                      Application details
                    </Link>
                    {resultHref && (
                      <Link href={resultHref} className={actionLinkClass}>
                        <RscChatCircleIcon className="h-4 w-4 shrink-0" />
                        Interview result
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
            </div>

            <div className="mt-10 hidden overflow-hidden rounded-xl border border-[#EAEAEA] bg-[#FFFFFF] dark:border-zinc-800 dark:bg-zinc-900 md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <caption className="sr-only">
                  Your job applications: role, applied date, pipeline status, CV and interview scores, hiring score, and
                  links to the listing, details, and interview result when available.
                </caption>
                <thead className="sticky top-0 z-[1] border-b border-[#E6E5E2] bg-[#F2F1EE] dark:border-zinc-800 dark:bg-zinc-950">
                  <tr>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.06em] text-[#787774] dark:text-zinc-500"
                    >
                      Job
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.06em] text-[#787774] dark:text-zinc-500"
                    >
                      Applied
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.06em] text-[#787774] dark:text-zinc-500"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[#787774] dark:text-zinc-500"
                    >
                      CV
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[#787774] dark:text-zinc-500"
                    >
                      Interview
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[#787774] dark:text-zinc-500"
                    >
                      Hiring
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.06em] text-[#787774] dark:text-zinc-500"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAEA] dark:divide-zinc-800">
                  {applications.map((r) => {
                    const job = r.job_listings;
                    const title = job?.title ?? "Job";
                    const company = companyNameFromJob(job);
                    const hiring = applicationHiringScore(r);
                    const pipeline = r.application_status || "applied";
                    const mi = interviewByJob.get(r.job_id);
                    const resultHref = interviewResultHref(mi?.id, mi?.interview_language);

                    return (
                      <tr
                        key={r.id}
                        className="transition-colors duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none hover:bg-[#F5F4F1] dark:hover:bg-zinc-800/40"
                      >
                        <th scope="row" className="px-5 py-4 align-top font-normal">
                          <div className="font-medium text-[#111] dark:text-zinc-100">{title}</div>
                          <div className="mt-1 text-xs font-normal text-[#787774] dark:text-zinc-400">{company}</div>
                        </th>
                        <td className="px-5 py-4 align-top text-[#2F3437] dark:text-zinc-400">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <CandidateApplicationStatusBadge applicationStatus={pipeline} />
                        </td>
                        <td className="px-5 py-4 align-top text-right font-mono tabular-nums text-[#111] dark:text-zinc-100">
                          {typeof r.cv_score === "number" ? r.cv_score : "—"}
                        </td>
                        <td className="px-5 py-4 align-top text-right font-mono tabular-nums text-[#111] dark:text-zinc-100">
                          {typeof r.interview_score === "number" ? r.interview_score : "—"}
                        </td>
                        <td className="px-5 py-4 align-top text-right font-mono tabular-nums text-[#111] dark:text-zinc-100">
                          {hiring}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex flex-col gap-1.5">
                            <Link href={`/dashboard/jobs/${r.job_id}`} className={actionLinkClassTable}>
                              Listing
                            </Link>
                            <Link href={`/dashboard/applications/${r.id}`} className={actionMutedClassTable}>
                              Details
                            </Link>
                            {resultHref && (
                              <Link href={resultHref} className={actionLinkClassTable}>
                                Interview
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
            </div>
          </MinimalSection>
        )}
      </main>
    </div>
  );
}
