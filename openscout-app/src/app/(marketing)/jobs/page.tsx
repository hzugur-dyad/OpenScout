import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Briefcase } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default async function JobsPage() {
  const supabase = await createClient();
  const { data: listings } = await supabase
    .from("job_listings")
    .select(`
      id,
      title,
      description,
      min_cv_score,
      companies(name)
    `)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">Job Listings</h1>
      <p className="mt-1 text-gray-500">
        Browse open positions and apply.
      </p>

      {!listings || listings.length === 0 ? (
        <div className="mt-12 rounded-[10px] border border-dashed border-gray-300 p-12 text-center">
          <Briefcase className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-500">No open listings yet.</p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {listings.map((job: { id: string; title: string; description: string | null; min_cv_score: number | null; companies: unknown }) => (
            <Link key={job.id} href={`/jobs/${job.id}`}>
              <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft transition-shadow hover:shadow-card">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{job.title}</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {String(Array.isArray(job.companies) ? job.companies[0]?.name : (job.companies as { name?: string })?.name) || "Company"}
                    </p>
                    {job.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                        {job.description}
                      </p>
                    )}
                  </div>
                  <Button variant="outline" size="sm">
                    Apply
                  </Button>
                </div>
                {job.min_cv_score != null && (
                  <p className="mt-2 text-xs text-gray-400">
                    Min. CV score: {job.min_cv_score}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
