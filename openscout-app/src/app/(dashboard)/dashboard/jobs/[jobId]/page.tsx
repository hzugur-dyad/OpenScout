import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { slugifyJobTitle, getJobTitleBySlug } from "@/lib/seo/job-titles";

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

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/jobs" className="text-sm text-gray-500 hover:underline dark:text-zinc-400 dark:hover:text-zinc-300">
        ← Back to listings
      </Link>
      <div className="mt-6 rounded-[10px] border border-[var(--border)] bg-white p-8 shadow-card dark:border-zinc-700 dark:bg-zinc-900">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{jobTitle}</h1>
        <p className="mt-1 text-gray-500 dark:text-zinc-400">
          {String((job.companies as { name?: string } | null)?.name ?? "Company")}
        </p>
        {job.min_cv_score != null && (
          <p className="mt-2 text-sm text-gray-500 dark:text-zinc-500">
            Minimum CV score: {job.min_cv_score}
          </p>
        )}
        {job.description && (
          <div className="mt-6">
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Description</h3>
            <p className="mt-2 whitespace-pre-wrap text-gray-600 dark:text-zinc-300">{job.description}</p>
          </div>
        )}
        {job.requirements && (
          <div className="mt-6">
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Requirements</h3>
            <p className="mt-2 whitespace-pre-wrap text-gray-600 dark:text-zinc-300">{job.requirements}</p>
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
