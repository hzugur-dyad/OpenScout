import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { absoluteUrl } from "@/lib/seo/site";

export default async function JobsPage() {
  const supabase = await createClient();
  const { data: listings } = await supabase
    .from("job_listings")
    .select(
      `
      id,
      title,
      description,
      min_cv_score,
      companies(name)
    `
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const jsonLd =
    listings && listings.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: listings.map(
            (job: { id: string; title: string }, index: number) => ({
              "@type": "ListItem",
              position: index + 1,
              name: job.title,
              url: absoluteUrl(`/jobs/${job.id}`),
            })
          ),
        }
      : null;

  return (
    <div className="mx-auto max-w-4xl dark:bg-transparent">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Job Listings</h1>
      <p className="mt-1 text-gray-500 dark:text-zinc-400">Browse open positions and apply.</p>

      {!listings || listings.length === 0 ? (
        <EmptyState
          className="mt-10"
          iconName="briefcase"
          title="No open listings yet"
          description="Check back soon for Scout-vetted roles."
        >
          <Link href="/">
            <Button variant="primary">Home</Button>
          </Link>
        </EmptyState>
      ) : (
        <div className="mt-8 space-y-4">
          {listings.map(
            (job: {
              id: string;
              title: string;
              description: string | null;
              min_cv_score: number | null;
              companies: unknown;
            }) => (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft transition-shadow hover:shadow-card dark:border-white/[0.12] dark:bg-black/25 dark:backdrop-blur-xl dark:hover:shadow-card">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-zinc-100">{job.title}</h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                        {String(
                          Array.isArray(job.companies)
                            ? job.companies[0]?.name
                            : (job.companies as { name?: string })?.name
                        ) || "Company"}
                      </p>
                      {job.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-zinc-400">
                          {job.description}
                        </p>
                      )}
                    </div>
                    <Button variant="outline" size="sm">
                      Apply
                    </Button>
                  </div>
                  {job.min_cv_score != null && (
                    <p className="mt-2 text-xs text-gray-400 dark:text-zinc-500">
                      Min. CV score: {job.min_cv_score}
                    </p>
                  )}
                </div>
              </Link>
            )
          )}
        </div>
      )}
    </div>
  );
}
