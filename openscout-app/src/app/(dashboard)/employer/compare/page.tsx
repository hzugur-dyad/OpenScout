import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseCompareApplicationIds } from "@/lib/employer-applications-list";
import { EmployerApplicationStatusBadge } from "@/components/employer/EmployerApplicationStatusBadge";
import { HiringFitBadge } from "@/components/employer/HiringFitBadge";
import { Button } from "@/components/ui/Button";
import {
  computeHiringScore,
  hiringFitTagFromScore,
  hiringScoreInputsFromInterviewRow,
  HIRING_SCORE_WEIGHT_LABELS,
} from "@/lib/hiring-score";
import { userHasCompanyAccess } from "@/lib/employer-company";

export default async function EmployerComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawIds = typeof sp.ids === "string" ? sp.ids : Array.isArray(sp.ids) ? sp.ids[0] : "";
  const ids = parseCompareApplicationIds(rawIds);

  if (ids.length < 2 || ids.length > 3) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Compare candidates</h1>
        <p className="mt-2 text-gray-600 dark:text-zinc-400">
          Select 2–3 applications from a job listing, then use &quot;Compare selected&quot; on the applications table.
        </p>
        <Link href="/employer" className="mt-6 inline-block">
          <Button variant="outline">Back to employer</Button>
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/employer/login");

  const { data: apps } = await supabase
    .from("job_applications")
    .select(
      `
      id,
      job_id,
      user_id,
      interview_score,
      cv_score,
      interview_report,
      application_status,
      profiles(first_name, last_name, email)
    `
    )
    .in("id", ids);

  if (!apps || apps.length !== ids.length) notFound();

  type CompareRow = {
    id: string;
    job_id: string;
    interview_score: number | null;
    cv_score: number | null;
    interview_report: Record<string, unknown> | null;
    application_status?: string;
    profiles: { first_name?: string; last_name?: string; email?: string } | null;
  };
  const rows = apps as CompareRow[];

  const jobId = rows[0].job_id;
  if (!rows.every((a) => a.job_id === jobId)) notFound();

  const { data: job } = await supabase
    .from("job_listings")
    .select("id, title, company_id")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) notFound();

  const companyId = (job as { company_id: string }).company_id;
  const { data: company } = await supabase
    .from("companies")
    .select("stripe_subscription_status")
    .eq("id", companyId)
    .maybeSingle();

  const subscribed = (company as { stripe_subscription_status?: string } | null)?.stripe_subscription_status === "active";
  const hasAccess = await userHasCompanyAccess(supabase, user.id, companyId);
  if (!company || !hasAccess || !subscribed) notFound();

  const ordered = ids.map((id) => rows.find((a) => a.id === id)).filter((a): a is CompareRow => Boolean(a));

  let bestRowId: string | null = null;
  let bestHiringScore = -1;
  for (const row of ordered) {
    const h = computeHiringScore(hiringScoreInputsFromInterviewRow(row));
    if (h > bestHiringScore) {
      bestHiringScore = h;
      bestRowId = row.id;
    }
  }
  if (bestHiringScore <= 0) bestRowId = null;

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={`/employer/${jobId}/applications`}
        className="text-sm text-gray-500 hover:underline dark:text-zinc-400 dark:hover:text-zinc-300"
      >
        ← Back to applications
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-zinc-100">Compare candidates</h1>
      <p className="mt-1 text-gray-500 dark:text-zinc-400">{(job as { title: string }).title}</p>
      <p className="mt-3 max-w-2xl text-xs text-gray-500 dark:text-zinc-500">
        Hiring score blends available signals with fixed weights:{" "}
        {HIRING_SCORE_WEIGHT_LABELS.map((w) => `${w.label} ${Math.round(w.weight * 100)}%`).join(", ")}. Missing
        dimensions are renormalized automatically.
      </p>

      <div
        className="mt-8 grid gap-4"
        style={{ gridTemplateColumns: `repeat(${ordered.length}, minmax(0, 1fr))` }}
      >
        {ordered.map((row) => {
          const profile = row.profiles;
          const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "Candidate";
          const report = row.interview_report ?? null;
          const tech = typeof report?.technical_score === "number" ? report.technical_score : null;
          const comm = typeof report?.communication_score === "number" ? report.communication_score : null;
          const ps = typeof report?.problem_solving_score === "number" ? report.problem_solving_score : null;
          const strengths = Array.isArray(report?.strengths)
            ? (report.strengths as unknown[]).filter((s): s is string => typeof s === "string")
            : [];
          const improvements = Array.isArray(report?.improvements)
            ? (report.improvements as unknown[]).filter((s): s is string => typeof s === "string")
            : [];
          const appStatus = row.application_status || "applied";
          const overall = row.interview_score;
          const hiringScore = computeHiringScore(hiringScoreInputsFromInterviewRow(row));
          const fitTag = hiringFitTagFromScore(hiringScore);
          const isBest = bestRowId !== null && row.id === bestRowId;

          return (
            <div
              key={row.id}
              className={`rounded-[10px] border bg-white p-5 shadow-soft dark:bg-zinc-900 ${
                isBest
                  ? "border-[var(--primary)] ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-white dark:border-[var(--primary)] dark:ring-offset-zinc-950"
                  : "border-[var(--border)] dark:border-white/[0.06]"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-gray-900 dark:text-zinc-100">{name}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  {isBest && (
                    <span className="rounded bg-[var(--primary)] px-2 py-0.5 text-xs font-semibold text-white">
                      Best fit
                    </span>
                  )}
                  <EmployerApplicationStatusBadge status={appStatus} />
                </div>
              </div>
              {profile?.email && <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">{profile.email}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-500 dark:text-zinc-500">Hiring score</span>
                <span className="font-semibold text-gray-900 dark:text-zinc-100">{hiringScore}</span>
                <HiringFitBadge tag={fitTag} />
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500 dark:text-zinc-500">Interview overall</span>
                  <span className="font-medium text-gray-900 dark:text-zinc-100">{overall ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500 dark:text-zinc-500">CV fit</span>
                  <span className="font-medium text-gray-900 dark:text-zinc-100">{row.cv_score ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500 dark:text-zinc-500">Technical</span>
                  <span className="font-medium text-gray-900 dark:text-zinc-100">{tech ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500 dark:text-zinc-500">Communication</span>
                  <span className="font-medium text-gray-900 dark:text-zinc-100">{comm ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500 dark:text-zinc-500">Problem solving</span>
                  <span className="font-medium text-gray-900 dark:text-zinc-100">{ps ?? "—"}</span>
                </div>
              </div>

              {strengths.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-medium text-gray-600 dark:text-zinc-400">Strengths</h3>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-gray-700 dark:text-zinc-300">
                    {strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {improvements.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-medium text-gray-600 dark:text-zinc-400">Areas for improvement</h3>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-gray-700 dark:text-zinc-300">
                    {improvements.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
