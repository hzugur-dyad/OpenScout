/** Query param consumed by `/mock-interview` to pre-select job category from SEO slugs. */
export function seoMockInterviewHref(jobSlug: string): string {
  return `/mock-interview?job=${encodeURIComponent(jobSlug)}`;
}
