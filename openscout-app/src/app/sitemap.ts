import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteUrl } from "@/lib/seo/site";
import { fetchActiveJobsForSitemap } from "@/lib/seo/jobs-fetch";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const jobs = await fetchActiveJobsForSitemap();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/jobs"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  const jobEntries: MetadataRoute.Sitemap = jobs.flatMap((j) => {
    const lastMod = j.updated_at ? new Date(j.updated_at) : new Date();
    return [
      {
        url: absoluteUrl(`/jobs/${j.id}`),
        lastModified: lastMod,
        changeFrequency: "weekly" as const,
        priority: 0.85,
      },
      {
        url: absoluteUrl(`/jobs/${j.id}/apply`),
        lastModified: lastMod,
        changeFrequency: "weekly" as const,
        priority: 0.75,
      },
    ];
  });

  return [...staticEntries, ...jobEntries];
}
