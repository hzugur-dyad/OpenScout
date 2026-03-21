import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { EmployerApplicationNotesForm } from "@/components/employer/EmployerApplicationNotesForm";
import { EmployerApplicationStatusActions } from "@/components/employer/EmployerApplicationStatusActions";

export default async function EmployerApplicationDetailPage({
  params,
}: {
  params: Promise<{ jobId: string; applicationId: string }>;
}) {
  const { jobId, applicationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/employer/login");

  const { data: job } = await supabase
    .from("job_listings")
    .select("id, title, company_id")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) notFound();

  const { data: company } = await supabase
    .from("companies")
    .select("id, stripe_subscription_status")
    .eq("id", (job as { company_id: string }).company_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!company) notFound();

  const isSubscribed = (company as { stripe_subscription_status?: string }).stripe_subscription_status === "active";

  if (!isSubscribed) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/employer/${jobId}/applications`}
          className="text-sm text-gray-500 hover:underline dark:text-zinc-400 dark:hover:text-zinc-300"
        >
          ← Back to applications
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-zinc-100">Application</h1>
        <p className="mt-4 text-gray-600 dark:text-zinc-400">Upgrade to Growth to view application details.</p>
        <Link href="/employer/pricing" className="mt-6 inline-block">
          <Button variant="primary">View pricing</Button>
        </Link>
      </div>
    );
  }

  const { data: application } = await supabase
    .from("job_applications")
    .select(
      `
      id,
      user_id,
      status,
      application_status,
      notes,
      cv_score,
      interview_score,
      interview_report,
      created_at,
      profiles(first_name, last_name, email)
    `
    )
    .eq("id", applicationId)
    .eq("job_id", jobId)
    .maybeSingle();

  if (!application) notFound();

  const profile = (application as { profiles?: { first_name?: string; last_name?: string; email?: string } | null })
    .profiles;
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "Candidate";
  const report = application.interview_report as {
    strengths?: string[];
    improvements?: string[];
    technical_score?: number;
    communication_score?: number;
    problem_solving_score?: number;
  } | null;

  const hasBreakdown =
    report &&
    (typeof report.technical_score === "number" ||
      typeof report.communication_score === "number" ||
      typeof report.problem_solving_score === "number");
  const hasStrengths = report?.strengths && report.strengths.length > 0;
  const hasImprovements = report?.improvements && report.improvements.length > 0;
  const hasReportContent = hasBreakdown || hasStrengths || hasImprovements;

  const pipelineStatus = (application as { application_status?: string }).application_status || "applied";
  const notes = (application as { notes?: string | null }).notes ?? null;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/employer/${jobId}/applications`}
        className="text-sm text-gray-500 hover:underline dark:text-zinc-400 dark:hover:text-zinc-300"
      >
        ← Back to applications
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-zinc-100">Application</h1>
      <p className="mt-1 text-gray-500 dark:text-zinc-400">
        {(job as { title?: string }).title} · {name}
      </p>

      <p className="mt-2 rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-800 dark:bg-green-950/50 dark:text-green-200">
        Scout-vetted — CV and interview scores verified by OpenScout.
      </p>

      <div className="mt-8 space-y-6">
        <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
          <h2 className="font-semibold text-gray-800 dark:text-zinc-100">Candidate</h2>
          <p className="mt-1 font-medium text-gray-900 dark:text-zinc-200">{name}</p>
          {profile?.email && <p className="text-sm text-gray-500 dark:text-zinc-400">{profile.email}</p>}
          <p className="mt-2 font-mono text-xs text-gray-400 dark:text-zinc-500">{application.user_id}</p>
        </div>

        <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
          <h2 className="font-semibold text-gray-800 dark:text-zinc-100">Hiring actions</h2>
          <div className="mt-3">
            <EmployerApplicationStatusActions applicationId={application.id} currentStatus={pipelineStatus} />
          </div>
        </div>

        <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
          <h2 className="font-semibold text-gray-800 dark:text-zinc-100">Notes</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">Visible only to your team (stored on this application).</p>
          <div className="mt-3">
            <EmployerApplicationNotesForm applicationId={application.id} initialNotes={notes} />
          </div>
        </div>

        <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
          <h2 className="font-semibold text-gray-800 dark:text-zinc-100">Scores</h2>
          <div className="mt-3 flex flex-wrap gap-6">
            <div>
              <span className="text-sm text-gray-500 dark:text-zinc-500">CV score</span>
              <p className="text-xl font-semibold text-gray-900 dark:text-zinc-100">{application.cv_score ?? "—"}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-zinc-500">Interview overall score</span>
              <p className="text-xl font-semibold text-gray-900 dark:text-zinc-100">{application.interview_score ?? "—"}</p>
            </div>
          </div>
          {application.created_at && (
            <p className="mt-3 text-sm text-gray-500 dark:text-zinc-500">
              Applied: {new Date(application.created_at).toLocaleString()}
            </p>
          )}
        </div>

        {hasReportContent && (
          <div className="space-y-6 rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
            <h2 className="font-semibold text-gray-800 dark:text-zinc-100">Interview Report</h2>

            <section>
              <h3 className="text-sm font-medium text-gray-600 dark:text-zinc-400">Interview Score</h3>
              <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-zinc-100">
                {application.interview_score != null ? `${application.interview_score}/100` : "—"}
              </p>
            </section>

            {hasBreakdown && (
              <section>
                <h3 className="text-sm font-medium text-gray-600 dark:text-zinc-400">Score Breakdown</h3>
                <div className="mt-2 flex flex-wrap gap-4">
                  {typeof report!.technical_score === "number" && (
                    <div className="min-w-[120px] rounded-lg bg-gray-50 px-3 py-2 dark:bg-zinc-800">
                      <span className="text-xs text-gray-500 dark:text-zinc-500">Technical</span>
                      <p className="font-semibold text-gray-800 dark:text-zinc-100">{report!.technical_score}/100</p>
                    </div>
                  )}
                  {typeof report!.communication_score === "number" && (
                    <div className="min-w-[120px] rounded-lg bg-gray-50 px-3 py-2 dark:bg-zinc-800">
                      <span className="text-xs text-gray-500 dark:text-zinc-500">Communication</span>
                      <p className="font-semibold text-gray-800 dark:text-zinc-100">{report!.communication_score}/100</p>
                    </div>
                  )}
                  {typeof report!.problem_solving_score === "number" && (
                    <div className="min-w-[120px] rounded-lg bg-gray-50 px-3 py-2 dark:bg-zinc-800">
                      <span className="text-xs text-gray-500 dark:text-zinc-500">Problem solving</span>
                      <p className="font-semibold text-gray-800 dark:text-zinc-100">{report!.problem_solving_score}/100</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {hasStrengths && (
              <section>
                <h3 className="text-sm font-medium text-gray-600 dark:text-zinc-400">Strengths</h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-gray-700 dark:text-zinc-300">
                  {report!.strengths!.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </section>
            )}

            {hasImprovements && (
              <section>
                <h3 className="text-sm font-medium text-gray-600 dark:text-zinc-400">Areas for Improvement</h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-gray-700 dark:text-zinc-300">
                  {report!.improvements!.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>

      <div className="mt-8">
        <Link href={`/employer/${jobId}/applications`}>
          <Button variant="outline">Back to list</Button>
        </Link>
      </div>
    </div>
  );
}
