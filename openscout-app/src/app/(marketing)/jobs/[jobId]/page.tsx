import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { slugifyJobTitle, getJobTitleBySlug } from "@/lib/seo/job-titles";
import { fetchActiveJobForSeo } from "@/lib/seo/jobs-fetch";
import { buildJobDetailMetadata } from "@/lib/seo/job-metadata";
import { buildJobPostingJsonLd } from "@/lib/seo/job-posting-schema";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ jobId: string }>;
}): Promise<Metadata> {
  const { jobId } = await params;
  const job = await fetchActiveJobForSeo(jobId);
  if (!job) {
    return { title: "Job not found", robots: { index: false, follow: false } };
  }
  return buildJobDetailMetadata(job);
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await fetchActiveJobForSeo(jobId);

  if (!job) notFound();

  const jobTitle = job.title;
  const slug = slugifyJobTitle(jobTitle);
  const knownTitle = getJobTitleBySlug(slug);
  const jobPostingJsonLd = buildJobPostingJsonLd(job);

  return (
    <div className="mx-auto max-w-3xl dark:bg-transparent">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd) }}
      />
      <Link href="/jobs" className="text-sm text-gray-500 hover:underline dark:text-zinc-400 dark:hover:text-zinc-300">
        ← Back to listings
      </Link>
      <div className="mt-6 rounded-[10px] border border-[var(--border)] bg-white p-8 shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{jobTitle}</h1>
        <p className="mt-1 text-gray-500 dark:text-zinc-400">
          {job.companies?.name ?? "Company"}
        </p>
        {job.min_cv_score != null && (
          <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
            Minimum CV score: {job.min_cv_score}
          </p>
        )}
        {job.description && (
          <div className="mt-6">
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Description</h3>
            <p className="mt-2 whitespace-pre-wrap text-gray-600 dark:text-zinc-400">{job.description}</p>
          </div>
        )}
        {job.requirements && (
          <div className="mt-6">
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Requirements</h3>
            <p className="mt-2 whitespace-pre-wrap text-gray-600 dark:text-zinc-400">{job.requirements}</p>
          </div>
        )}
        {knownTitle && (
          <p className="mt-6 text-sm text-gray-600 dark:text-zinc-400">
            Prepare for interviews:{" "}
            <Link href={`/interview-questions/${slug}`} className="text-[var(--primary)] hover:underline">
              Interview questions for {knownTitle}
            </Link>
            {" · "}
            <Link href={`/interview-guide/${slug}`} className="text-[var(--primary)] hover:underline">
              Interview guide
            </Link>
          </p>
        )}
        <Link href={`/jobs/${jobId}/apply`} className="mt-8 inline-block">
          <Button variant="primary" size="lg">
            Apply
          </Button>
        </Link>
      </div>
    </div>
  );
}
