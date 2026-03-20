import "server-only";
import { createClient } from "@supabase/supabase-js";

export type JobListingSeo = {
  id: string;
  title: string;
  description: string | null;
  requirements: string | null;
  min_cv_score: number | null;
  created_at: string;
  updated_at: string;
  companies: { name: string } | null;
};

function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function normalizeCompanies(embed: unknown): { name: string } | null {
  if (!embed) return null;
  if (Array.isArray(embed)) {
    const first = embed[0] as { name?: string } | undefined;
    if (first?.name) return { name: first.name };
    return null;
  }
  if (typeof embed === "object" && embed !== null && "name" in embed) {
    return { name: String((embed as { name: string }).name) };
  }
  return null;
}

/** Active job row for metadata, JSON-LD, and sitemap (no cookies; uses anon + public RLS). */
export async function fetchActiveJobForSeo(jobId: string): Promise<JobListingSeo | null> {
  const supabase = createAnonClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("job_listings")
    .select("id, title, description, requirements, min_cv_score, created_at, updated_at, companies(name)")
    .eq("id", jobId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    requirements: (row.requirements as string | null) ?? null,
    min_cv_score: (row.min_cv_score as number | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    companies: normalizeCompanies(row.companies),
  };
}

export async function fetchActiveJobsForSitemap(): Promise<
  Pick<JobListingSeo, "id" | "updated_at">[]
> {
  const supabase = createAnonClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("job_listings")
    .select("id, updated_at")
    .eq("is_active", true);

  if (error || !data) return [];
  return data as Pick<JobListingSeo, "id" | "updated_at">[];
}
