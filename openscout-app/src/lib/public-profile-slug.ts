import { slugifyJobTitle } from "@/lib/seo/job-titles";

/** URL-safe handle from display name (reuses SEO slug rules). */
export function slugifyPublicProfileHandle(raw: string): string {
  const s = slugifyJobTitle(raw || "");
  return s || "candidate";
}
