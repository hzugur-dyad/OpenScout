import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { EmployerCheckoutButton } from "@/components/employer/EmployerCheckoutButton";
import { getTrialStatus } from "@/lib/employer-trial";

export default async function EmployerPricingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/employer/login");

  const { data: company } = await supabase
    .from("companies")
    .select("id,trial_started_at,stripe_subscription_status,plan")
    .eq("user_id", user.id)
    .maybeSingle();

  const trial = getTrialStatus((company as { trial_started_at?: string } | null)?.trial_started_at ?? null);
  const isSubscribed = (company as { stripe_subscription_status?: string } | null)?.stripe_subscription_status === "active";
  const currentPlan = (company as { plan?: string } | null)?.plan ?? "trial";

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/employer" className="text-sm text-gray-500 hover:underline">
        ← Back to employer
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Employer pricing</h1>
      <p className="mt-1 text-gray-500">
        Get Scout-vetted candidates. One credential, many hires.
      </p>

      {!isSubscribed && trial.isInTrial && (
        <div className="mt-4 rounded-[10px] border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-800">
            You have {trial.daysLeft} {trial.daysLeft === 1 ? "day" : "days"} left in your free trial (1 listing).
          </p>
        </div>
      )}
      {!isSubscribed && trial.trialExpired && (
        <div className="mt-4 rounded-[10px] border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            Your free trial has expired. Subscribe to continue using the platform.
          </p>
        </div>
      )}

      {!company && (
        <div className="mt-6 rounded-[10px] border border-amber-200 bg-amber-50 p-4">
          <p className="font-medium text-amber-800">Create a company first</p>
          <p className="mt-1 text-sm text-amber-700">
            You need a company to subscribe. Create one from the employer dashboard.
          </p>
          <Link href="/employer" className="mt-3 inline-block">
            <Button variant="outline" size="sm">Go to employer dashboard</Button>
          </Link>
        </div>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {/* Free Trial */}
        <div className="rounded-[10px] border-2 border-[var(--border)] bg-white p-8 shadow-soft">
          <h2 className="text-lg font-semibold text-gray-500">Free Trial</h2>
          <p className="mt-2 text-3xl font-bold">
            $0 <span className="text-base font-normal text-gray-500">/ 7 days</span>
          </p>
          <ul className="mt-6 space-y-3 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              1 job listing
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Scout-vetted applications
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              CV + interview scores
            </li>
          </ul>
          <div className="mt-8">
            <Button variant="outline" className="w-full" disabled>
              {trial.isInTrial ? `${trial.daysLeft}d left` : trial.trialExpired ? "Trial expired" : "7-day trial"}
            </Button>
          </div>
        </div>

        {/* Growth */}
        <div className={`rounded-[10px] border-2 bg-white p-8 shadow-card ${currentPlan === "growth" ? "border-green-500" : "border-[var(--primary)]"}`} style={currentPlan !== "growth" ? { borderColor: "var(--primary)" } : {}}>
          {currentPlan !== "growth" && (
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "var(--primary-muted)", color: "var(--primary-dark)" }}>Popular</span>
            </div>
          )}
          <h2 className="mt-2 text-lg font-semibold">Growth</h2>
          <p className="mt-2 text-3xl font-bold" style={{ color: "var(--primary-dark)" }}>
            $99 <span className="text-base font-normal text-gray-500">/ month</span>
          </p>
          <ul className="mt-6 space-y-3 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Unlimited job listings
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              50 total applications
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Full application reports
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Priority support
            </li>
          </ul>
          <div className="mt-8">
            {currentPlan === "growth" && isSubscribed ? (
              <Button variant="outline" className="w-full" disabled>Current plan</Button>
            ) : (
              <EmployerCheckoutButton plan="growth" companyId={company?.id} />
            )}
          </div>
        </div>

        {/* Scale */}
        <div className={`rounded-[10px] border-2 bg-white p-8 shadow-card ${currentPlan === "scale" ? "border-green-500" : "border-[var(--border)]"}`}>
          <h2 className="text-lg font-semibold">Scale</h2>
          <p className="mt-2 text-3xl font-bold">
            $149 <span className="text-base font-normal text-gray-500">/ month</span>
          </p>
          <ul className="mt-6 space-y-3 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Unlimited job listings
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              100 total applications
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Full application reports
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Priority support
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Dedicated account manager
            </li>
          </ul>
          <div className="mt-8">
            {currentPlan === "scale" && isSubscribed ? (
              <Button variant="outline" className="w-full" disabled>Current plan</Button>
            ) : (
              <EmployerCheckoutButton plan="scale" companyId={company?.id} />
            )}
          </div>
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-gray-500">
        Candidates are always free. You only pay to post and hire.
      </p>
    </div>
  );
}
