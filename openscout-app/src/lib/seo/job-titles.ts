/**
 * Single source of truth for job titles used across the app and SEO pages.
 * Slug utilities for URL-safe segments.
 */

export const JOB_TITLES = [
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Mobile Developer",
  "DevOps Engineer",
  "Data Scientist",
  "Product Manager",
  "Java Developer",
  "C++ Developer",
  "Python Developer",
  "UX Designer",
  "UI Designer",
  "Marketing",
  "Finance",
  "Human Resources",
  "Project Manager",
  "Other",
] as const;

export type JobTitle = (typeof JOB_TITLES)[number];

/** Normalize and slugify a job title for URL segments (lowercase, spaces to hyphens, strip non-alphanumeric except hyphen). */
export function slugifyJobTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Resolve URL slug back to canonical job title from JOB_TITLES, or null if unknown. */
export function getJobTitleBySlug(slug: string): string | null {
  const normalized = slug.trim().toLowerCase();
  for (const title of JOB_TITLES) {
    if (slugifyJobTitle(title) === normalized) return title;
  }
  return null;
}

/** All slugs for generateStaticParams and sitemap. */
export function getAllJobSlugs(): string[] {
  return JOB_TITLES.map((t) => slugifyJobTitle(t));
}
