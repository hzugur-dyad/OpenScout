import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmployerApplicationsControls } from "@/components/employer/EmployerApplicationsControls";
import { EmployerApplicationsInteractiveTable } from "@/components/employer/EmployerApplicationsInteractiveTable";
import {
  filterEmployerApplications,
  sortEmployerApplications,
  parseApplicationsListQuery,
  type EmployerApplicationListItem,
} from "@/lib/employer-applications-list";

export default async function EmployerApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { jobId } = await params;
  const sp = await searchParams;
  const { sort, status: statusFilter, minScore } = parseApplicationsListQuery(sp);

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

  let rawApplications: EmployerApplicationListItem[] = [];
  let applications: EmployerApplicationListItem[] = [];
  if (isSubscribed) {
    const { data } = await supabase
      .from("job_applications")
      .select(
        `
        id,
        user_id,
        application_status,
        cv_score,
        interview_score,
        interview_report,
        created_at,
        profiles(first_name, last_name, email)
      `
      )
      .eq("job_id", jobId);

    rawApplications = (data ?? []) as EmployerApplicationListItem[];
    const filtered = filterEmployerApplications(rawApplications, statusFilter, minScore);
    applications = sortEmployerApplications(filtered, sort);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/employer"
            className="text-sm text-gray-500 hover:underline dark:text-zinc-400 dark:hover:text-zinc-300"
          >
            ← Back to employer
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-zinc-100">Applications</h1>
          <p className="mt-1 text-gray-500 dark:text-zinc-400">
            Listing: <span className="font-medium text-gray-700 dark:text-zinc-200">{job.title}</span>
          </p>
          <p className="mt-1 text-sm font-medium text-gray-600 dark:text-zinc-400">
            Only Scout-vetted candidates — each has completed CV analysis and AI interview.
          </p>
        </div>
        <Link href={`/employer/${jobId}/edit`}>
          <Button variant="outline">Edit listing</Button>
        </Link>
      </div>

      {!isSubscribed ? (
        <div className="mt-10 rounded-[10px] border border-[var(--primary)] bg-[var(--primary-lighter)]/30 p-10 text-center dark:bg-primary-muted/30">
          <p className="font-medium text-gray-800 dark:text-zinc-200">Upgrade to Growth to view applications</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">
            Application details are available on the Growth plan.
          </p>
          <Link href="/employer/pricing" className="mt-4 inline-block">
            <Button variant="primary">View pricing</Button>
          </Link>
        </div>
      ) : rawApplications.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={Inbox}
          title="No applications yet"
          description="When candidates meet your CV score requirement and complete the AI interview, they will show up here."
        >
          <Link href="/employer">
            <Button variant="primary">Back to dashboard</Button>
          </Link>
          <Link href={`/employer/${jobId}/edit`}>
            <Button variant="outline">Edit listing</Button>
          </Link>
        </EmptyState>
      ) : applications.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={Inbox}
          title="No applications match"
          description="Try changing status or minimum interview score filters."
        >
          <Link href={`/employer/${jobId}/applications`}>
            <Button variant="primary">Clear filters</Button>
          </Link>
        </EmptyState>
      ) : (
        <>
          <Suspense fallback={<div className="mb-4 h-10" aria-hidden />}>
            <EmployerApplicationsControls />
          </Suspense>
          <EmployerApplicationsInteractiveTable jobId={jobId} applications={applications} />
        </>
      )}
    </div>
  );
}
