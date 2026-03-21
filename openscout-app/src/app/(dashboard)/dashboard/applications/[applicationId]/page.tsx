import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { CandidateApplicationStatusBadge } from "@/components/candidate/CandidateApplicationStatusBadge";
import { applicationHiringScore } from "@/lib/candidate-applications-list";
import { HiringFitBadge } from "@/components/employer/HiringFitBadge";
import { hiringFitTagFromScore } from "@/lib/hiring-score";
import { parseInterviewLocale, type InterviewLocale } from "@/lib/interview-locale";

type PageProps = { params: Promise<{ applicationId: string }> };

export default async function CandidateApplicationDetailPage({ params }: PageProps) {
  const { applicationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
  if (profile?.role === "employer") redirect("/employer");

  const { data: application } = await supabase
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
        description,
        companies ( name )
      )
    `
    )
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!application) notFound();

  const jlRaw = application.job_listings as unknown;
  const job = (
    Array.isArray(jlRaw) ? jlRaw[0] : jlRaw
  ) as {
    id: string;
    title: string;
    description: string | null;
    companies: { name: string } | { name: string }[] | null;
  } | null;

  const companyRaw = job?.companies;
  const companyName = Array.isArray(companyRaw) ? companyRaw[0]?.name : companyRaw?.name;

  const report = application.interview_report as {
    strengths?: string[];
    improvements?: string[];
    technical_score?: number;
    communication_score?: number;
    problem_solving_score?: number;
  } | null;

  const strengths = Array.isArray(report?.strengths)
    ? report!.strengths!.filter((s): s is string => typeof s === "string")
    : [];
  const improvements = Array.isArray(report?.improvements)
    ? report!.improvements!.filter((s): s is string => typeof s === "string")
    : [];

  const hiringScore = applicationHiringScore({
    interview_score: application.interview_score as number | null,
    interview_report: application.interview_report,
  });
  const fitTag = hiringFitTagFromScore(hiringScore);

  const { data: mi } = await supabase
    .from("mock_interviews")
    .select("id, interview_language")
    .eq("user_id", user.id)
    .eq("job_id", application.job_id as string)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const locale: InterviewLocale = parseInterviewLocale(mi?.interview_language ?? undefined);
  const resultHref = mi?.id
    ? `/mock-interview/${mi.id as string}/result?${new URLSearchParams({ lang: locale }).toString()}`
    : null;

  const pipeline = (application.application_status as string) || "applied";

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/dashboard/applications"
        className="text-sm text-gray-500 hover:underline dark:text-zinc-400 dark:hover:text-zinc-300"
      >
        ← All applications
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-zinc-100">Application</h1>
      <p className="mt-1 text-gray-500 dark:text-zinc-400">
        Submitted{" "}
        {application.created_at ? new Date(application.created_at).toLocaleString() : "—"}
      </p>

      <div className="mt-6 rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Role</h2>
        <p className="mt-2 text-xl font-medium text-gray-900 dark:text-zinc-100">{job?.title ?? "Job"}</p>
        <p className="text-sm text-gray-600 dark:text-zinc-400">{companyName ?? "—"}</p>
        {job?.description && (
          <p className="mt-4 line-clamp-6 text-sm text-gray-700 dark:text-zinc-300">{job.description}</p>
        )}
        <div className="mt-4">
          <Link href={`/dashboard/jobs/${application.job_id as string}`}>
            <Button variant="outline" size="sm">
              View job listing
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-500 dark:text-zinc-500">Status</span>
        <CandidateApplicationStatusBadge applicationStatus={pipeline} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-[10px] border border-[var(--border)] bg-white p-4 dark:border-white/[0.06] dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-400">CV score</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-zinc-100">
            {typeof application.cv_score === "number" ? application.cv_score : "—"}
          </p>
        </div>
        <div className="rounded-[10px] border border-[var(--border)] bg-white p-4 dark:border-white/[0.06] dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-400">
            Interview score
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-zinc-100">
            {typeof application.interview_score === "number" ? application.interview_score : "—"}
          </p>
        </div>
        <div className="rounded-[10px] border border-[var(--border)] bg-white p-4 dark:border-white/[0.06] dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-400">
            Hiring score
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-zinc-100">{hiringScore}</p>
          <div className="mt-2">
            <HiringFitBadge tag={fitTag} />
          </div>
        </div>
      </div>

      {(strengths.length > 0 || improvements.length > 0) && (
        <div className="mt-8 space-y-6">
          {strengths.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Strengths</h2>
              <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-gray-700 dark:text-zinc-300">
                {strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>
          )}
          {improvements.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Improvements</h2>
              <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-gray-700 dark:text-zinc-300">
                {improvements.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {resultHref && (
        <div className="mt-8">
          <Link href={resultHref}>
            <Button variant="primary">Open interview result</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
