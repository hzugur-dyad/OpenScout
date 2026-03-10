import type { MetadataRoute } from "next";
import { getAllJobSlugs } from "@/lib/seo/job-titles";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://openscout.app");

const SEO_SEGMENTS = [
  "interview-questions",
  "interview-guide",
  "resume-examples",
  "skills",
  "salary",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/blog/why-scout-credential`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/blog/what-employers-see`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/jobs`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE_URL}/register`, lastModified: now, changeFrequency: "yearly", priority: 0.8 },
  ];

  const seoPages: MetadataRoute.Sitemap = [];
  const slugs = getAllJobSlugs();
  for (const segment of SEO_SEGMENTS) {
    for (const slug of slugs) {
      seoPages.push({
        url: `${BASE_URL}/${segment}/${slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }

  return [...staticPages, ...seoPages];
}
