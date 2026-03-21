import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmployerJobForm } from "@/components/employer/EmployerJobForm";
import { Button } from "@/components/ui/Button";
import { getTrialStatus } from "@/lib/employer-trial";
import { getEmployerPrimaryCompany } from "@/lib/employer-company";

export default async function EmployerNewListingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/employer/login");

  const company = await getEmployerPrimaryCompany(supabase, user.id);

  if (!company) redirect("/employer");

  const isSubscribed = (company as { stripe_subscription_status?: string }).stripe_subscription_status === "active";
  const trial = getTrialStatus((company as { trial_started_at?: string }).trial_started_at ?? null);

  let listingCount = 0;
  if (company?.id) {
    const { count } = await supabase
      .from("job_listings")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id);
    listingCount = count ?? 0;
  }

  const trialLimitReached = trial.isInTrial && !isSubscribed && listingCount >= 1;
  const trialExpiredNotSubscribed = trial.trialExpired && !isSubscribed;
  const showUpgradeGate = trialLimitReached || trialExpiredNotSubscribed || (!isSubscribed && !trial.isInTrial && listingCount >= 1);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">New job listing</h1>
      <p className="mt-1 text-gray-500">Create a listing that candidates can apply to.</p>

      {showUpgradeGate ? (
        <div className="mt-8 rounded-[10px] border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="font-medium text-amber-800">
            {trialExpiredNotSubscribed
              ? "Your free trial has expired."
              : trialLimitReached
              ? "Free trial allows only 1 job listing."
              : "Free plan allows one job listing."}
          </p>
          <p className="mt-1 text-sm text-amber-700">
            Subscribe to post more listings and reach Scout-vetted candidates.
          </p>
          <Link href="/employer/pricing" className="mt-4 inline-block">
            <Button variant="primary">View plans</Button>
          </Link>
          <Link href="/employer" className="mt-3 block text-sm text-amber-700 hover:underline">
            ← Back to employer
          </Link>
        </div>
      ) : (
        <div className="mt-8">
          <EmployerJobForm mode="create" companyId={company.id} />
        </div>
      )}
    </div>
  );
}

