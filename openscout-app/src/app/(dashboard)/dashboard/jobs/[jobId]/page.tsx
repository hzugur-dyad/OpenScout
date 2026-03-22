import Link from "next/link";
import { notFound } from "next/navigation";
import { Newsreader } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { RscCaretLeftIcon } from "@/components/icons/PhosphorRscIcons";
import { slugifyJobTitle, getJobTitleBySlug } from "@/lib/seo/job-titles";
import { cn } from "@/lib/utils";

const jobDetailSerif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600"],
});

export default async function DashboardJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("job_listings")
    .select(`
      id,
      title,
      description,
      requirements,
      min_cv_score,
      companies(name)
    `)
    .eq("id", jobId)
    .eq("is_active", true)
    .single();

  if (!job) notFound();

  const jobTitle = job.title as string;
  const slug = slugifyJobTitle(jobTitle);
  const knownTitle = getJobTitleBySlug(slug);

  const companyLabel = String(
    (job.companies as { name?: string } | null)?.name ?? "Hiring organization"
  );

  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <Link
        href="/dashboard/jobs"
        className={cn(
          "inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-consistent px-3 py-2 text-sm font-medium",
          "text-[#111111]/55 transition-colors ease-out hover:text-[#111111] dark:text-zinc-400 dark:hover:text-zinc-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-950"
        )}
      >
        <RscCaretLeftIcon className="size-4 shrink-0" />
        Back to listings
      </Link>

      <article
        aria-labelledby="job-detail-title"
        className="mt-8 rounded-consistent border border-[var(--border-strong)] bg-[#FAFAF9] px-6 py-8 sm:px-8 sm:py-10 dark:border-zinc-800 dark:bg-zinc-950/80"
      >
        <header className="pb-8">
          <span className="inline-flex max-w-full rounded-full bg-[#e8f4fa] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-[#1a5f8a] dark:bg-sky-950/45 dark:text-sky-200/95">
            <span className="truncate">{companyLabel}</span>
          </span>
          <h1
            id="job-detail-title"
            className={cn(
              jobDetailSerif.className,
              "mt-4 text-[1.625rem] font-normal leading-[1.2] tracking-[-0.03em] text-[#111111] sm:text-[1.875rem] dark:text-zinc-50"
            )}
          >
            {jobTitle}
          </h1>
          {job.min_cv_score != null ? (
            <p className="mt-4 font-mono text-xs tabular-nums text-[#111111]/55 dark:text-zinc-500">
              Minimum CV score:{" "}
              <span className="font-medium text-[#111111] dark:text-zinc-300">{job.min_cv_score}</span>
            </p>
          ) : null}
        </header>

        {job.description ? (
          <section className="mt-8" aria-labelledby="job-description-heading">
            <h2
              id="job-description-heading"
              className="text-sm font-medium tracking-tight text-[#111111] dark:text-zinc-100"
            >
              Description
            </h2>
            <p className="mt-3 max-w-[65ch] whitespace-pre-wrap text-base leading-[1.5] text-[#111111]/60 dark:text-zinc-400">
              {job.description}
            </p>
          </section>
        ) : null}

        {job.requirements ? (
          <section className="mt-8" aria-labelledby="job-requirements-heading">
            <h2
              id="job-requirements-heading"
              className="text-sm font-semibold tracking-tight text-[#111111] dark:text-zinc-100"
            >
              Requirements
            </h2>
            <p className="mt-3 max-w-[65ch] whitespace-pre-wrap text-base leading-[1.6] text-[#787774] dark:text-zinc-400">
              {job.requirements}
            </p>
          </section>
        ) : null}

        {knownTitle ? (
          <section
            className="mt-8 rounded-consistent border border-[var(--border-strong)] bg-[#FCFCFB] px-4 py-4 dark:border-zinc-700 dark:bg-zinc-900/40"
            aria-labelledby="job-prep-heading"
          >
            <h2 id="job-prep-heading" className="text-sm font-medium text-[#111111] dark:text-zinc-100">
              Interview prep
            </h2>
            <p className="mt-2 text-sm leading-[1.5] text-[#111111]/60 dark:text-zinc-400">
              <Link
                href={`/interview-questions/${slug}`}
                className="font-medium text-[var(--primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900"
              >
                Questions for {knownTitle}
              </Link>
              <span className="mx-1.5 text-[#eaeaea] dark:text-zinc-600" aria-hidden>
                ·
              </span>
              <Link
                href={`/interview-guide/${slug}`}
                className="font-medium text-[var(--primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900"
              >
                Interview guide
              </Link>
            </p>
          </section>
        ) : null}

        <div className="mt-12 flex flex-col gap-4 pt-2 sm:flex-row sm:items-center">
          <Link
            href={`/jobs/${jobId}/apply`}
            className={cn(
              "inline-flex h-12 min-h-12 w-full touch-manipulation items-center justify-center rounded-consistent px-8 text-base font-medium transition-colors duration-200 ease-out",
              "bg-primary text-white hover:bg-primary-light hover:text-primary-dark active:bg-primary-dark active:text-white",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAFAF9] dark:focus-visible:ring-offset-zinc-950",
              "sm:w-auto"
            )}
          >
            Apply for this role
          </Link>
          <p className="text-center text-xs leading-[1.5] text-[#111111]/55 sm:text-left dark:text-zinc-500">
            You will continue on the application flow from your current plan.
          </p>
        </div>
      </article>
    </div>
  );
}
