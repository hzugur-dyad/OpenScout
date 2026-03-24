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
  const employerPlanLabel = currentPlan === "scale" ? "Scale" : currentPlan === "growth" ? "Growth" : "Free trial";
  const employerPriceLine = currentPlan === "scale" ? "$149 / month" : currentPlan === "growth" ? "$99 / month" : "$0 / 7 days";

  return (
    <div className="mx-auto max-w-5xl">
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
      {isSubscribed && (
        <section
          aria-label="Current subscription summary"
          className="mt-8 rounded-[12px] border border-[#EAEAEA] bg-white p-5 dark:border-white/[0.1] dark:bg-zinc-950/40"
        >
          <dl className="grid gap-3 text-sm">
            <div className="grid grid-cols-[6rem_1fr] items-start gap-3">
              <dt className="text-[#787774] dark:text-zinc-500">Plan</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">{employerPlanLabel}</dd>
            </div>
            <div className="grid grid-cols-[6rem_1fr] items-start gap-3">
              <dt className="text-[#787774] dark:text-zinc-500">Price</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">{employerPriceLine}</dd>
            </div>
            <div className="grid grid-cols-[6rem_1fr] items-start gap-3">
              <dt className="text-[#787774] dark:text-zinc-500">Renewal</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">Renews on next billing date</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="#employer-pricing-plan-comparison">
              <Button variant="secondary" size="sm">
                Change Plan
              </Button>
            </a>
            <a href="/api/billing/portal?scope=employer">
              <Button variant="outline" size="sm">
                Cancel Plan
              </Button>
            </a>
          </div>
        </section>
      )}

      <section aria-labelledby="employer-pricing-plan-comparison">
        <h2
          id="employer-pricing-plan-comparison"
          className="mt-10 text-xs font-semibold uppercase tracking-[0.14em] text-[#787774] dark:text-zinc-500"
        >
          Compare plans
        </h2>

        <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-white/75 bg-white/60 shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur-xl ring-1 ring-black/[0.04] dark:border-white/[0.08] dark:bg-black/45 dark:backdrop-blur-xl dark:ring-white/[0.03]">
          <div className="grid divide-y divide-[var(--border)] dark:divide-white/[0.08] md:grid-cols-3 md:divide-x md:divide-y-0">
            {/* Trial */}
            <article className="group relative flex h-full flex-col px-6 py-9 transition-colors duration-200 motion-reduce:transition-none sm:px-8 sm:py-10">
              <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Free trial
              </h3>
              <p className="mt-1 text-xs leading-[1.6] text-zinc-700 dark:text-zinc-300">
                One listing to validate the pipeline before you commit.
              </p>
              <div className="mt-8 flex flex-wrap items-baseline gap-x-1.5">
                <span className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                  $0
                </span>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">/ 7 days</span>
              </div>
              <ul className="mt-8 flex flex-1 flex-col gap-2.5 border-t border-[var(--border)] pt-8 dark:border-white/[0.06]">
                <li className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">
                  <RscCheckIcon className={`${checkClass} mr-2 inline-block align-middle`} />
                  1 job listing
                </li>
                <li className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">
                  <RscCheckIcon className={`${checkClass} mr-2 inline-block align-middle`} />
                  Scout-vetted applications
                </li>
                <li className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">
                  <RscCheckIcon className={`${checkClass} mr-2 inline-block align-middle`} />
                  CV and interview scores
                </li>
              </ul>
              <div className="mt-10 flex flex-1 flex-col justify-end">
                <Button variant="outline" className="h-12 w-full rounded-xl shadow-none" disabled>
                  {trial.isInTrial
                    ? `${trial.daysLeft}d left`
                    : trial.trialExpired
                      ? "Trial expired"
                      : "7-day trial"}
                </Button>
              </div>
            </article>

            {/* Growth */}
            <article className="group relative flex h-full flex-col bg-gradient-to-b from-[var(--primary-muted)]/50 via-transparent to-transparent px-6 py-9 transition-colors duration-200 motion-reduce:transition-none sm:px-8 sm:py-10 dark:from-primary/10 dark:via-transparent">
              <div
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent opacity-90"
                aria-hidden
              />
              {currentPlan !== "growth" && (
                <span className="absolute right-6 top-5 rounded-full bg-[var(--primary-muted)] px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.05em] text-[var(--primary-dark)]">
                  Popular
                </span>
              )}
              <div className={currentPlan !== "growth" ? "pr-[5.5rem]" : undefined}>
                <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Growth
                </h3>
                <p className="mt-1 text-xs leading-[1.6] text-zinc-700 dark:text-zinc-300">
                  Most teams start here
                </p>
              </div>
              <div className="mt-8 flex flex-wrap items-baseline gap-x-1.5">
                <span className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                  $99
                </span>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">/ month</span>
              </div>
              <ul className="mt-8 flex flex-1 flex-col gap-2.5 border-t border-[var(--border)] pt-8 dark:border-white/[0.06]">
                <li className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">
                  <RscCheckIcon className={`${checkClass} mr-2 inline-block align-middle`} />
                  Unlimited job listings
                </li>
                <li className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">
                  <RscCheckIcon className={`${checkClass} mr-2 inline-block align-middle`} />
                  50 total applications
                </li>
                <li className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">
                  <RscCheckIcon className={`${checkClass} mr-2 inline-block align-middle`} />
                  Full application reports
                </li>
                <li className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">
                  <RscCheckIcon className={`${checkClass} mr-2 inline-block align-middle`} />
                  Priority support
                </li>
              </ul>
              <div className="mt-10 flex flex-1 flex-col justify-end">
                {currentPlan === "growth" && isSubscribed ? (
                  <Button variant="outline" className="h-12 w-full rounded-xl shadow-none" disabled>
                    Current plan
                  </Button>
                ) : (
                  <EmployerCheckoutButton plan="growth" companyId={company.id} />
                )}
              </div>
            </article>

            {/* Scale */}
            <article className="group relative flex h-full flex-col px-6 py-9 transition-colors duration-200 motion-reduce:transition-none sm:px-8 sm:py-10">
              <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Scale
              </h3>
              <p className="mt-1 text-xs leading-[1.6] text-zinc-700 dark:text-zinc-300">
                Higher application cap and a named contact
              </p>
              <div className="mt-8 flex flex-wrap items-baseline gap-x-1.5">
                <span className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                  $149
                </span>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">/ month</span>
              </div>
              <ul className="mt-8 flex flex-1 flex-col gap-2.5 border-t border-[var(--border)] pt-8 dark:border-white/[0.06]">
                <li className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">
                  <RscCheckIcon className={`${checkClass} mr-2 inline-block align-middle`} />
                  Unlimited job listings
                </li>
                <li className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">
                  <RscCheckIcon className={`${checkClass} mr-2 inline-block align-middle`} />
                  100 total applications
                </li>
                <li className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">
                  <RscCheckIcon className={`${checkClass} mr-2 inline-block align-middle`} />
                  Full application reports
                </li>
                <li className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">
                  <RscCheckIcon className={`${checkClass} mr-2 inline-block align-middle`} />
                  Priority support
                </li>
                <li className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">
                  <RscCheckIcon className={`${checkClass} mr-2 inline-block align-middle`} />
                  Dedicated account manager
                </li>
              </ul>
              <div className="mt-10 flex flex-1 flex-col justify-end">
                {currentPlan === "scale" && isSubscribed ? (
                  <Button variant="outline" className="h-12 w-full rounded-xl shadow-none" disabled>
                    Current plan
                  </Button>
                ) : (
                  <EmployerCheckoutButton plan="scale" companyId={company.id} />
                )}
              </div>
            </article>
          </div>
        </div>
      </section>

      <p className="mt-10 max-w-[65ch] text-sm leading-relaxed text-zinc-500 dark:text-zinc-500">
        USD · Billed monthly after checkout. Candidates are never charged.
      </p>
    </div>
  );
}
