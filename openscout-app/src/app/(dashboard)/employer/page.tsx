import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { CreateCompanyCard } from "@/components/employer/CreateCompanyCard";
import { CompleteEmployerRegistration } from "@/components/employer/CompleteEmployerRegistration";
import { EditCompanyName } from "@/components/employer/EditCompanyName";
import { EmployerSubscriptionSuccess } from "@/components/employer/EmployerSubscriptionSuccess";
import { getTrialStatus } from "@/lib/employer-trial";

export default async function EmployerHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/employer/login");

  const { data: company } = await supabase
    .from("companies")
    .select("id,name,stripe_subscription_status,trial_started_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!company) {
    return (
      <div className="mx-auto max-w-4xl">
        <CompleteEmployerRegistration />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Employer</h1>
        <p className="mt-1 text-gray-500 dark:text-zinc-400">Post job listings and review applications.</p>
        <div className="mt-8">
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

  return (
    <div className="mx-auto max-w-4xl">
      <EmployerSubscriptionSuccess />
      {!isSubscribed && trial.isInTrial && (
        <div className="mb-6 rounded-[10px] border border-blue-200 bg-blue-50 p-4">
          <p className="font-medium text-blue-800">
            Free trial: {trial.daysLeft} {trial.daysLeft === 1 ? "day" : "days"} left. You can create 1 job listing during the trial.
          </p>
          <Link href="/employer/pricing" className="mt-2 inline-block text-sm font-medium text-blue-700 underline">
            Subscribe now for unlimited listings →
          </Link>
        </div>
      )}
      {!isSubscribed && trial.trialExpired && (
        <div className="mb-6 rounded-[10px] border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-800">
            Your free trial has expired. Subscribe to continue posting jobs and receiving applications.
          </p>
          <Link href="/employer/pricing" className="mt-2 inline-block text-sm font-medium text-red-700 underline">
            Subscribe now →
          </Link>
        </div>
      )}
      {!isSubscribed && !trial.trialExpired && !trial.isInTrial && (
        <div className="mb-6 rounded-[10px] border border-[var(--primary)] bg-[var(--primary-lighter)]/30 p-4">
          <p className="font-medium" style={{ color: "var(--primary-dark)" }}>
            Get Scout-vetted candidates — Upgrade for unlimited listings and full reports.
          </p>
          <Link href="/employer/pricing" className="mt-2 inline-block text-sm font-medium underline" style={{ color: "var(--primary-dark)" }}>
            View pricing →
          </Link>
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Employer</h1>
          <div className="mt-1 text-gray-500 dark:text-zinc-400">
            Company: <EditCompanyName companyId={company.id} initialName={company.name} />
          </div>
          <p className="mt-1 text-sm font-medium text-gray-600 dark:text-zinc-400">
            Only Scout-vetted candidates — every application includes CV + interview scores and report.
          </p>
        </div>
        <div className="flex gap-2">
          {isSubscribed && (
            <Link href="/employer/pricing">
              <Button variant="outline" size="sm">Billing</Button>
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
        <div className="mt-10 rounded-[10px] border border-dashed border-gray-300 bg-white p-10 text-center dark:border-zinc-600 dark:bg-zinc-900">
          <p className="text-gray-600 dark:text-zinc-300">No job listings yet.</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-500">Create your first listing to start receiving applications.</p>
          <div className="mt-6">
            <Link href="/employer/new">
              <Button variant="primary">Create listing</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {listings.map((job) => (
            <div
              key={job.id}
              className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-zinc-100">{job.title}</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                    {job.is_active ? "Active (public)" : "Inactive (hidden)"} · Min CV score: {job.min_cv_score ?? 0}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/jobs/${job.id}`}>
                    <Button variant="outline" size="sm">Public page</Button>
                  </Link>
                  <Link href={`/employer/${job.id}/applications`}>
                    <Button variant="secondary" size="sm">Applications</Button>
                  </Link>
                  <Link href={`/employer/${job.id}/edit`}>
                    <Button variant="primary" size="sm">Edit</Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

