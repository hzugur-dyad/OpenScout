import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE_PATH } from "@/lib/seo/site";
import type { JobListingSeo } from "@/lib/seo/jobs-fetch";

function ogImageAbsolute(): string {
  return absoluteUrl(DEFAULT_OG_IMAGE_PATH);
}

function jobDescriptionSnippet(job: JobListingSeo): string {
  const raw = job.description?.replace(/\s+/g, " ").trim();
  if (raw && raw.length > 0) return raw.slice(0, 160);
  return `Apply for ${job.title} on OpenScout — AI-powered hiring and interviews.`;
}

export function buildJobDetailMetadata(job: JobListingSeo): Metadata {
  const canonical = absoluteUrl(`/jobs/${job.id}`);
  const description = jobDescriptionSnippet(job);

  return {
    title: job.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "OpenScout",
      title: `${job.title} | OpenScout`,
      description,
      images: [{ url: ogImageAbsolute(), width: 1200, height: 630, alt: job.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${job.title} | OpenScout`,
      description,
      images: [ogImageAbsolute()],
    },
  };
}

export function buildJobApplyMetadata(job: JobListingSeo): Metadata {
  const canonical = absoluteUrl(`/jobs/${job.id}/apply`);
  const description = `Apply to ${job.title}: CV screening and AI interview on OpenScout.`;

  return {
    title: `${job.title} — Apply`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "OpenScout",
      title: `${job.title} — Apply | OpenScout`,
      description,
      images: [{ url: ogImageAbsolute(), width: 1200, height: 630, alt: job.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${job.title} — Apply | OpenScout`,
      description,
      images: [ogImageAbsolute()],
    },
  };
}
