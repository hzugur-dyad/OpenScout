import Link from "next/link";
import { Newsreader } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RscBriefcaseBoldIcon } from "@/components/icons/PhosphorRscIcons";
import {
  DashboardJobsList,
  type DashboardJobRow,
} from "@/components/dashboard/DashboardJobsList";
import { cn } from "@/lib/utils";

const jobsSerif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600"],
});

function companyNameFromRow(companies: unknown): string {
  if (!companies) return "Hiring organization";
  if (Array.isArray(companies)) {
    const n = (companies[0] as { name?: string } | undefined)?.name;
    return typeof n === "string" && n.trim() ? n.trim() : "Hiring organization";
  }
  const n = (companies as { name?: string }).name;
  return typeof n === "string" && n.trim() ? n.trim() : "Hiring organization";
}

export default async function DashboardJobsPage() {
  const supabase = await createClient();
  const { data: listings } = await supabase
    .from("job_listings")
    .select(
      `
      id,
      title,
      description,
      min_cv_score,
      created_at,
      companies(name)
    `
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const rows: DashboardJobRow[] = (listings ?? []).map(
    (job: {
      id: string;
      title: string;
      description: string | null;
      min_cv_score: number | null;
      created_at: string | null;
      companies: unknown;
    }) => ({
      id: job.id,
      title: job.title,
      description: job.description,
      minCvScore: job.min_cv_score,
      companyName: companyNameFromRow(job.companies),
      postedAt: job.created_at,
    })
  );

  const count = rows.length;

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div className="overflow-hidden rounded-consistent border border-[var(--border-strong)] bg-[#FAFAF9] px-6 py-10 dark:border-zinc-800 dark:bg-zinc-950 sm:px-8 sm:py-12 md:px-10 md:py-14">
        <header className="mb-10 flex flex-col gap-8 md:mb-12 md:flex-row md:items-end md:justify-between md:gap-12">
          <div className="min-w-0 max-w-3xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-consistent bg-[#f5edd8] text-[#8a6a1e] dark:bg-amber-950/35 dark:text-amber-200/85"
                aria-hidden
              >
                <RscBriefcaseBoldIcon className="size-[22px]" />
              </span>
              <div className="min-w-0">
                <h1
                  id="dashboard-jobs-title"
                  className={cn(
                    jobsSerif.className,
                    "text-[1.75rem] font-normal leading-[1.2] tracking-[-0.03em] text-[#111111] sm:text-[2rem] dark:text-zinc-50"
                  )}
                >
                  Job Listings
                </h1>
                <p className="mt-4 max-w-[60ch] text-base leading-[1.5] text-[#111111]/60 dark:text-zinc-400">
                  Roles posted by hiring partners. Choose a row to read the full brief and apply when it fits your plan.
                </p>
              </div>
            </div>
          </div>
          {count > 0 ? (
            <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
              <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#111111]/55 dark:text-zinc-500">
                Open
              </span>
              <p className="font-mono text-sm font-medium tabular-nums tracking-tight text-[#111111] dark:text-zinc-200">
                {count}
                {count === 1 ? " role" : " roles"}
              </p>
            </div>
          ) : null}
        </header>

        {!listings || listings.length === 0 ? (
          <EmptyState
            className="mt-0 rounded-consistent border border-dashed border-[var(--border-strong)] bg-[#FCFCFB] px-8 py-14 dark:border-zinc-700 dark:bg-zinc-900/40"
            iconName="briefcase"
            title="No open roles yet"
            description="Nothing is live at the moment. Keep your profile and CV current so you can move quickly when listings return."
          >
            <Link href="/dashboard">
              <Button
                variant="primary"
                className="rounded-md border-0 bg-[#111111] text-white hover:bg-[#333333] focus:ring-zinc-500 dark:bg-zinc-100 dark:text-[#111111] dark:hover:bg-white dark:focus:ring-zinc-400"
              >
                Dashboard
              </Button>
            </Link>
            <Link href="/cv-analysis">
              <Button
                variant="outline"
                className="rounded-consistent border-[var(--border-strong)] hover:bg-[#F2F1EF] active:bg-[#eae9e6] dark:border-zinc-700 dark:hover:bg-zinc-800 dark:active:bg-zinc-800/80"
              >
                Run CV analysis
              </Button>
            </Link>
            <Link href="/onboarding">
              <Button
                variant="outline"
                className="rounded-consistent border-[var(--border-strong)] hover:bg-[#F2F1EF] active:bg-[#eae9e6] dark:border-zinc-700 dark:hover:bg-zinc-800 dark:active:bg-zinc-800/80"
              >
                My profile
              </Button>
            </Link>
          </EmptyState>
        ) : (
          <DashboardJobsList jobs={rows} />
        )}
      </div>
    </div>
  );
}
