import Link from "next/link";
import { redirect } from "next/navigation";
import { Newsreader } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreateCompanyCard } from "@/components/employer/CreateCompanyCard";
import { CompleteEmployerRegistration } from "@/components/employer/CompleteEmployerRegistration";
import { EditCompanyName } from "@/components/employer/EditCompanyName";
import { EmployerSubscriptionSuccess } from "@/components/employer/EmployerSubscriptionSuccess";

const employerSerif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});
import { getTrialStatus } from "@/lib/employer-trial";
import {
  computeHiringScore,
  hiringScoreInputsFromInterviewRow,
} from "@/lib/hiring-score";
import { buildTopCandidateSummaryLine } from "@/lib/employer-intelligence";
import { getEmployerPrimaryCompany } from "@/lib/employer-company";

export default async function EmployerHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/employer/login");

  const company = await getEmployerPrimaryCompany(supabase, user.id);

  if (!company) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-10">
        <CompleteEmployerRegistration />
        <header className="space-y-3">
          <p className="os-eyebrow">Employer</p>
          <h1
            className={`text-[2rem] font-semibold leading-[1.12] tracking-[-0.03em] text-zinc-900 dark:text-zinc-50 md:text-[2.35rem] ${employerSerif.className}`}
          >
            Post jobs and review Scout-vetted applicants
          </h1>
          <p className="max-w-[60ch] text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            Create a company profile to publish listings and open your applications inbox.
          </p>
        </header>
        <div className="mt-2">
          <CreateCompanyCard />
        </div>
      </div>
    );
  }

  const { data: listings } = await supabase
    .from("job_listings")
    .select("id,title,is_active,created_at,min_cv_score")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  const isSubscribed = (company as { stripe_subscription_status?: string }).stripe_subscription_status === "active";
  const trial = getTrialStatus((company as { trial_started_at?: string }).trial_started_at ?? null);
  const canOperate = isSubscribed || trial.isInTrial;

  type AppRow = {
    id: string;
    job_id: string;
    cv_score: number | null;
    interview_score: number | null;
    interview_report: unknown;
    ai_recommendation_reason?: string | null;
    profiles: { first_name?: string; last_name?: string; email?: string } | null;
  };

  const topCandidateByJob = new Map<
    string,
    { applicationId: string; displayName: string; hiringScore: number; summaryLine: string }
  >();

  if (isSubscribed && listings && listings.length > 0) {
    const jobIds = listings.map((l) => l.id);
    const { data: apps } = await supabase
      .from("job_applications")
      .select(
        "id, job_id, cv_score, interview_score, interview_report, ai_recommendation_reason, profiles(first_name, last_name, email)"
      )
      .in("job_id", jobIds);

    for (const jobId of jobIds) {
      const rows = ((apps ?? []) as AppRow[]).filter((a) => a.job_id === jobId);
      let best: AppRow | null = null;
      let bestScore = -1;
      for (const r of rows) {
        const hs = computeHiringScore(hiringScoreInputsFromInterviewRow(r));
        if (hs > bestScore) {
          bestScore = hs;
          best = r;
        }
      }
      if (best && rows.length > 0) {
        const p = best.profiles;
        const displayName =
          [p?.first_name, p?.last_name].filter(Boolean).join(" ") || p?.email || "Candidate";
        const minCv = listings.find((l) => l.id === jobId)?.min_cv_score ?? null;
        const summaryLine = buildTopCandidateSummaryLine(best, { minCvScore: minCv, durationMs: null });
        topCandidateByJob.set(jobId, {
          applicationId: best.id,
          displayName,
          hiringScore: bestScore,
          summaryLine,
        });
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10">
      <EmployerSubscriptionSuccess />
      {!isSubscribed && trial.isInTrial && (
        <div className="rounded-xl border border-sky-200/90 bg-sky-50/90 p-5 ring-1 ring-sky-950/[0.04] dark:border-sky-900/40 dark:bg-sky-950/30 dark:ring-white/[0.05]">
          <p className="text-sm font-semibold text-sky-950 dark:text-sky-100">
            Free trial: {trial.daysLeft} {trial.daysLeft === 1 ? "day" : "days"} left. You can create 1 job listing during the trial.
          </p>
          <Link
            href="/employer/pricing"
            className="mt-3 inline-flex text-sm font-medium text-sky-800 underline-offset-4 transition-colors hover:text-sky-950 dark:text-sky-300 dark:hover:text-sky-100"
          >
            Subscribe for unlimited listings →
          </Link>
        </div>
      )}
      {!isSubscribed && trial.trialExpired && (
        <div className="rounded-xl border border-red-200/90 bg-red-50/90 p-5 ring-1 ring-red-950/[0.05] dark:border-red-900/45 dark:bg-red-950/25 dark:ring-white/[0.05]">
          <p className="text-sm font-semibold text-red-950 dark:text-red-100">
            Your free trial has expired. Subscribe to continue posting jobs and receiving applications.
          </p>
          <Link
            href="/employer/pricing"
            className="mt-3 inline-flex text-sm font-medium text-red-800 underline-offset-4 transition-colors hover:text-red-950 dark:text-red-300 dark:hover:text-red-100"
          >
            Subscribe now →
          </Link>
        </div>
      )}
      {!isSubscribed && !trial.trialExpired && !trial.isInTrial && (
        <div
          className="rounded-xl border p-5 ring-1 ring-inset ring-black/[0.03] dark:ring-white/[0.06]"
          style={{
            borderColor: "var(--primary-muted)",
            background: "linear-gradient(135deg, rgba(220, 230, 174, 0.35) 0%, rgba(255,255,255,0.5) 100%)",
          }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--primary-dark)" }}>
            Get Scout-vetted candidates — upgrade for unlimited listings and full reports.
          </p>
          <Link
            href="/employer/pricing"
            className="mt-3 inline-flex text-sm font-medium underline-offset-4 transition-opacity hover:opacity-90"
            style={{ color: "var(--primary-dark)" }}
          >
            View pricing →
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-8 border-b border-zinc-200/80 pb-10 dark:border-zinc-800/80 lg:flex-row lg:items-end lg:justify-between">
        <header className="min-w-0 space-y-3">
          <p className="os-eyebrow">Hiring workspace</p>
          <h1
            className={`text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-zinc-900 dark:text-zinc-50 md:text-[2.35rem] ${employerSerif.className}`}
          >
            Employer
          </h1>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Company: <EditCompanyName companyId={company.id} initialName={company.name} />
          </div>
          <p className="max-w-[62ch] text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Only Scout-vetted candidates — every application includes CV score, mock interview score, and the report.
          </p>
        </header>
        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
          <Link href="/employer/team">
            <Button variant="outline" size="sm">
              Team
            </Button>
          </Link>
          {isSubscribed && (
            <Link href="/employer/pricing">
              <Button variant="outline" size="sm">
                Billing
              </Button>
            </Link>
          )}
          {canOperate && (
            <Link href="/employer/new">
              <Button variant="primary">New listing</Button>
            </Link>
          )}
          {!canOperate && (
            <Link href="/employer/pricing">
              <Button variant="primary">Subscribe to post</Button>
            </Link>
          )}
        </div>
      </div>

      {!listings || listings.length === 0 ? (
        <EmptyState
          className="border-zinc-200/90 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/40"
          iconName="briefcase"
          title="No job listings yet"
          description="Create your first listing to start receiving applications from candidates who cleared CV and mock interview gates."
        >
          <Link href="/employer/new">
            <Button variant="primary">Create listing</Button>
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-500">
            Active listings ({listings.length})
          </p>
          {listings.map((job) => {
            const topCandidate = topCandidateByJob.get(job.id);
            return (
            <div key={job.id} className="os-surface-card p-6 transition-[box-shadow] duration-200 lg:p-7">
              <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{job.title}</h3>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                        job.is_active
                          ? "bg-emerald-500/10 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "bg-zinc-500/10 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-400"
                      }`}
                    >
                      {job.is_active ? "Live" : "Hidden"}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Min CV score: <span className="font-mono tabular-nums text-zinc-900 dark:text-zinc-200">{job.min_cv_score ?? 0}</span>
                  </p>
                  {isSubscribed && topCandidate && (
                    <div className="mt-4 rounded-lg border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-700/80 dark:bg-zinc-950/50">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                          Top candidate
                        </span>
                        <Link
                          href={`/employer/${job.id}/applications/${topCandidate.applicationId}`}
                          className="text-sm font-semibold text-zinc-900 underline-offset-4 transition-colors hover:text-primary dark:text-zinc-100"
                        >
                          {topCandidate.displayName}
                        </Link>
                        <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                          Hiring score {topCandidate.hiringScore}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{topCandidate.summaryLine}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 lg:shrink-0">
                  <Link href={`/jobs/${job.id}`}>
                    <Button variant="outline" size="sm">
                      Public page
                    </Button>
                  </Link>
                  <Link href={`/employer/${job.id}/applications`}>
                    <Button variant="secondary" size="sm">
                      Applications
                    </Button>
                  </Link>
                  <Link href={`/employer/${job.id}/edit`}>
                    <Button variant="primary" size="sm">
                      Edit
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
