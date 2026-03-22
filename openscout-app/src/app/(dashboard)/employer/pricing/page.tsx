import Link from "next/link";
import { redirect } from "next/navigation";
import { RscCheckIcon, RscCaretLeftIcon } from "@/components/icons/PhosphorRscIcons";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { EmployerCheckoutButton } from "@/components/employer/EmployerCheckoutButton";
import { getTrialStatus } from "@/lib/employer-trial";
import { getEmployerPrimaryCompany } from "@/lib/employer-company";

export default async function EmployerPricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/employer/login");

  const company = await getEmployerPrimaryCompany(supabase, user.id);
  if (!company) redirect("/employer");

  const trial = getTrialStatus(company.trial_started_at ?? null);
  const isSubscribed = company.stripe_subscription_status === "active";
  const currentPlan = company.plan ?? "trial";

  const checkClass =
    "mt-0.5 h-4 w-4 shrink-0 text-[var(--primary-dark)] dark:text-[var(--primary-light)]";

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/employer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <RscCaretLeftIcon className="h-4 w-4" />
        Back to employer
      </Link>

      <header className="mt-8 max-w-2xl">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          Employer billing
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-4xl md:tracking-tighter">
          Pricing for hiring teams
        </h1>
        <p className="mt-3 max-w-[65ch] text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          Candidates stay free. You pay to post roles, review Scout-vetted applications, and close hires with less noise.
        </p>
      </header>

      {!isSubscribed && trial.isInTrial && (
        <div className="mt-8 rounded-[1.25rem] border border-zinc-200/90 bg-zinc-50/90 p-4 text-sm text-zinc-800 ring-1 ring-inset ring-zinc-950/[0.04] dark:border-white/[0.08] dark:bg-zinc-900/60 dark:text-zinc-200 dark:ring-white/[0.06]">
          <p className="font-medium">
            {trial.daysLeft} {trial.daysLeft === 1 ? "day" : "days"} left in your trial — 1 listing included.
          </p>
        </div>
      )}
      {!isSubscribed && trial.trialExpired && (
        <div className="mt-8 rounded-[1.25rem] border border-red-200/90 bg-red-50/90 p-4 text-sm text-red-900 ring-1 ring-inset ring-red-900/[0.06] dark:border-red-900/40 dark:bg-red-950/35 dark:text-red-200">
          <p className="font-medium">Your trial has ended. Subscribe to keep posting and reviewing applicants.</p>
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,17.5rem)_1fr] lg:grid-rows-2 lg:items-stretch">
        {/* Trial — left column, spans both rows */}
        <div className="flex flex-col rounded-[1.75rem] border border-[var(--border)] bg-white p-6 shadow-[0_20px_40px_-15px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.5)] ring-1 ring-inset ring-zinc-950/[0.04] dark:border-white/[0.08] dark:bg-zinc-900/85 dark:shadow-[0_24px_48px_-20px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] dark:ring-white/[0.06] lg:row-span-2 lg:p-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Free trial
          </h2>
          <p className="mt-3 font-mono text-3xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
            $0{" "}
            <span className="text-base font-sans font-medium tracking-normal text-zinc-500 dark:text-zinc-400">
              / 7 days
            </span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            One listing to validate the pipeline before you commit.
          </p>
          <ul className="mt-6 flex flex-1 flex-col gap-2.5 border-t border-[var(--border)] pt-6 text-sm text-zinc-600 dark:border-white/[0.08] dark:text-zinc-300">
            <li className="flex gap-2">
              <RscCheckIcon className={checkClass} />
              1 job listing
            </li>
            <li className="flex gap-2">
              <RscCheckIcon className={checkClass} />
              Scout-vetted applications
            </li>
            <li className="flex gap-2">
              <RscCheckIcon className={checkClass} />
              CV and interview scores
            </li>
          </ul>
          <div className="mt-8">
            <Button variant="outline" className="w-full" disabled>
              {trial.isInTrial
                ? `${trial.daysLeft}d left`
                : trial.trialExpired
                  ? "Trial expired"
                  : "7-day trial"}
            </Button>
          </div>
        </div>

        {/* Growth */}
        <div
          className={`flex flex-col rounded-[1.75rem] border bg-white p-6 shadow-[0_20px_40px_-15px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.5)] ring-1 ring-inset ring-zinc-950/[0.04] dark:bg-zinc-900/85 dark:shadow-[0_24px_48px_-20px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] dark:ring-white/[0.06] lg:p-8 ${
            currentPlan === "growth"
              ? "border-[color-mix(in_srgb,var(--primary)_55%,var(--border))] dark:border-[color-mix(in_srgb,var(--primary)_45%,transparent)]"
              : "border-[color-mix(in_srgb,var(--primary)_42%,var(--border))] dark:border-[color-mix(in_srgb,var(--primary)_35%,transparent)]"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Growth</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Most teams start here</p>
            </div>
            {currentPlan !== "growth" && (
              <span
                className="rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider"
                style={{
                  backgroundColor: "var(--primary-muted)",
                  color: "var(--primary-dark)",
                }}
              >
                Popular
              </span>
            )}
          </div>
          <p className="mt-5 font-mono text-3xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
            <span className="text-[var(--primary-dark)] dark:text-[var(--primary-light)]">$99</span>{" "}
            <span className="text-base font-sans font-medium tracking-normal text-zinc-500 dark:text-zinc-400">
              / month
            </span>
          </p>
          <ul className="mt-6 flex flex-1 flex-col gap-2.5 border-t border-[var(--border)] pt-6 text-sm text-zinc-600 dark:border-white/[0.08] dark:text-zinc-300">
            <li className="flex gap-2">
              <RscCheckIcon className={checkClass} />
              Unlimited job listings
            </li>
            <li className="flex gap-2">
              <RscCheckIcon className={checkClass} />
              50 total applications
            </li>
            <li className="flex gap-2">
              <RscCheckIcon className={checkClass} />
              Full application reports
            </li>
            <li className="flex gap-2">
              <RscCheckIcon className={checkClass} />
              Priority support
            </li>
          </ul>
          <div className="mt-8">
            {currentPlan === "growth" && isSubscribed ? (
              <Button variant="outline" className="w-full" disabled>
                Current plan
              </Button>
            ) : (
              <EmployerCheckoutButton plan="growth" companyId={company.id} />
            )}
          </div>
        </div>

        {/* Scale */}
        <div
          className={`flex flex-col rounded-[1.75rem] border bg-white p-6 shadow-[0_20px_40px_-15px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.5)] ring-1 ring-inset ring-zinc-950/[0.04] dark:bg-zinc-900/85 dark:shadow-[0_24px_48px_-20px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] dark:ring-white/[0.06] lg:p-8 ${
            currentPlan === "scale"
              ? "border-[color-mix(in_srgb,var(--primary)_55%,var(--border))] dark:border-[color-mix(in_srgb,var(--primary)_45%,transparent)]"
              : "border-[var(--border)] dark:border-white/[0.08]"
          }`}
        >
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Scale</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Higher application cap and a named contact</p>
          <p className="mt-5 font-mono text-3xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
            $149{" "}
            <span className="text-base font-sans font-medium tracking-normal text-zinc-500 dark:text-zinc-400">
              / month
            </span>
          </p>
          <ul className="mt-6 flex flex-1 flex-col gap-2.5 border-t border-[var(--border)] pt-6 text-sm text-zinc-600 dark:border-white/[0.08] dark:text-zinc-300">
            <li className="flex gap-2">
              <RscCheckIcon className={checkClass} />
              Unlimited job listings
            </li>
            <li className="flex gap-2">
              <RscCheckIcon className={checkClass} />
              100 total applications
            </li>
            <li className="flex gap-2">
              <RscCheckIcon className={checkClass} />
              Full application reports
            </li>
            <li className="flex gap-2">
              <RscCheckIcon className={checkClass} />
              Priority support
            </li>
            <li className="flex gap-2">
              <RscCheckIcon className={checkClass} />
              Dedicated account manager
            </li>
          </ul>
          <div className="mt-8">
            {currentPlan === "scale" && isSubscribed ? (
              <Button variant="outline" className="w-full" disabled>
                Current plan
              </Button>
            ) : (
              <EmployerCheckoutButton plan="scale" companyId={company.id} />
            )}
          </div>
        </div>
      </div>

      <p className="mt-10 max-w-[65ch] text-sm leading-relaxed text-zinc-500 dark:text-zinc-500">
        USD · Billed monthly after checkout. Candidates are never charged.
      </p>
    </div>
  );
}
