import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";

export default async function JobDetailPage({
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

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/jobs" className="text-sm text-gray-500 hover:underline">
        ← Back to listings
      </Link>
      <div className="mt-6 rounded-[10px] border border-[var(--border)] bg-white p-8 shadow-card">
        <h1 className="text-2xl font-bold">{job.title}</h1>
        <p className="mt-1 text-gray-500">
          {String((job.companies as { name?: string } | null)?.name ?? "Company")}
        </p>
        {job.min_cv_score != null && (
          <p className="mt-2 text-sm text-gray-500">
            Minimum CV score: {job.min_cv_score}
          </p>
        )}
        {job.description && (
          <div className="mt-6">
            <h3 className="font-semibold">Description</h3>
            <p className="mt-2 whitespace-pre-wrap text-gray-600">{job.description}</p>
          </div>
        )}
        {job.requirements && (
          <div className="mt-6">
            <h3 className="font-semibold">Requirements</h3>
            <p className="mt-2 whitespace-pre-wrap text-gray-600">{job.requirements}</p>
          </div>
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
