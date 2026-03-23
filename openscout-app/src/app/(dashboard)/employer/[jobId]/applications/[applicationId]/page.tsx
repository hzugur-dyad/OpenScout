import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { EmployerApplicationNotesForm } from "@/components/employer/EmployerApplicationNotesForm";
import { EmployerApplicationStatusActions } from "@/components/employer/EmployerApplicationStatusActions";
import { userHasCompanyAccess } from "@/lib/employer-company";
import {
  computeHiringScore,
  hiringScoreInputsFromInterviewRow,
  HIRING_SCORE_WEIGHT_LABELS,
} from "@/lib/hiring-score";
import { getEmployerIntelligence, employerDecisionRiskFlagLabel } from "@/lib/employer-intelligence";
import { HiringFitBadge } from "@/components/employer/HiringFitBadge";

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
    .select("id, title, company_id, min_cv_score")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) notFound();

  const companyId = (job as { company_id: string }).company_id;
  const hasAccess = await userHasCompanyAccess(supabase, user.id, companyId);
  const { data: company } = await supabase
    .from("companies")
    .select("id, stripe_subscription_status")
    .eq("id", companyId)
    .maybeSingle();

  if (!company || !hasAccess) notFound();

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
      ai_recommendation_reason,
      created_at,
      profiles(first_name, last_name, email)
    `
    )
    .eq("id", applicationId)
    .eq("job_id", jobId)
    .maybeSingle();

  if (!application) notFound();

  const { data: events } = await supabase
    .from("application_events")
    .select("id, event_type, old_status, new_status, note_excerpt, created_at, actor_user_id")
    .eq("job_application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(25);

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
  const aiReason = (application as { ai_recommendation_reason?: string | null }).ai_recommendation_reason ?? null;
  const minCvJob = (job as { min_cv_score?: number | null }).min_cv_score ?? 0;
  const hiringScore = computeHiringScore(
    hiringScoreInputsFromInterviewRow({
      interview_score: application.interview_score as number | null,
      interview_report: application.interview_report,
      cv_score: application.cv_score as number | null,
    })
  );
  const intel = getEmployerIntelligence(
    {
      cv_score: application.cv_score as number | null,
      interview_score: application.interview_score as number | null,
      interview_report: application.interview_report,
      ai_recommendation_reason: aiReason,
    },
    { minCvScore: minCvJob, durationMs: null }
  );

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
          <details className="mt-3 text-left">
            <summary className="cursor-pointer text-xs text-gray-400 underline decoration-gray-400/70 underline-offset-2 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-400">
              Technical details
            </summary>
            <p className="mt-2 break-all font-mono text-xs text-gray-400 dark:text-zinc-500">{application.user_id}</p>
          </details>
        </div>

        <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
          <h2 className="font-semibold text-gray-800 dark:text-zinc-100">Hiring actions</h2>
          <div className="mt-3">
            <EmployerApplicationStatusActions applicationId={application.id} currentStatus={pipelineStatus} />
          </div>
        </div>

        {(events?.length ?? 0) > 0 && (
          <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
            <h2 className="font-semibold text-gray-800 dark:text-zinc-100">Activity</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-zinc-300">
              {(events ?? []).map((ev) => {
                const e = ev as {
                  id: string;
                  event_type: string;
                  old_status?: string | null;
                  new_status?: string | null;
                  note_excerpt?: string | null;
                  created_at: string;
                };
                const when = e.created_at ? new Date(e.created_at).toLocaleString() : "";
                let line = `${e.event_type.replace(/_/g, " ")}`;
                if (e.event_type === "status_change" || e.event_type === "bulk_status_change") {
                  line = `Status ${e.old_status ?? "—"} → ${e.new_status ?? "—"}`;
                }
                if (e.event_type === "note_update" && e.note_excerpt) {
                  line = `Notes updated — ${e.note_excerpt}`;
                }
                return (
                  <li key={e.id} className="border-b border-[var(--border)] pb-2 last:border-0 dark:border-zinc-700">
                    <span className="text-xs text-gray-500 dark:text-zinc-500">{when}</span>
                    <p className="mt-0.5">{line}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

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
              <span className="text-sm text-gray-500 dark:text-zinc-500">Hiring score</span>
              <p className="text-xl font-semibold text-gray-900 dark:text-zinc-100">{hiringScore}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
                Weights:{" "}
                {HIRING_SCORE_WEIGHT_LABELS.map((w) => `${w.label} ${Math.round(w.weight * 100)}%`).join(", ")}.
              </p>
            </div>
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

        <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
          <h2 className="font-semibold text-gray-800 dark:text-zinc-100">AI Hiring Insight</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
            Rule-based summary from stored scores — not a live model call.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div>
              <span className="text-xs text-gray-500 dark:text-zinc-500">Hiring score</span>
              <p className="text-lg font-semibold text-gray-900 dark:text-zinc-100">{intel.hiringScore}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-zinc-500">Fit</span>
              <HiringFitBadge tag={intel.fitLabel} />
            </div>
          </div>
          <p className="mt-3 text-sm text-gray-800 dark:text-zinc-200">{intel.recommendationReason}</p>
          {intel.strongestDimension && (
            <p className="mt-2 text-xs text-gray-600 dark:text-zinc-400">
              <span className="font-medium text-gray-700 dark:text-zinc-300">Strongest:</span>{" "}
              {intel.strongestDimension.label} ({intel.strongestDimension.score})
            </p>
          )}
          {intel.weakestDimension && (
            <p className="mt-1 text-xs text-gray-600 dark:text-zinc-400">
              <span className="font-medium text-gray-700 dark:text-zinc-300">Weakest:</span>{" "}
              {intel.weakestDimension.label} ({intel.weakestDimension.score})
            </p>
          )}
          {intel.riskFlags.length > 0 ? (
            <div className="mt-3">
              <h3 className="text-xs font-medium text-amber-900 dark:text-amber-200">Risk flags</h3>
              <ul className="mt-1 list-inside list-disc text-sm text-amber-950 dark:text-amber-100">
                {intel.riskFlags.map((f) => (
                  <li key={f}>{employerDecisionRiskFlagLabel(f)}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-xs text-gray-500 dark:text-zinc-500">No automated risk flags for this profile.</p>
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
