import type { JobListingSeo } from "@/lib/seo/jobs-fetch";
import { absoluteUrl } from "@/lib/seo/site";

function companyName(job: JobListingSeo): string {
  return job.companies?.name?.trim() || "Hiring company";
}

function plainDescription(job: JobListingSeo): string {
  const parts = [job.description, job.requirements].filter(Boolean) as string[];
  const text = parts.join("\n\n").replace(/\s+/g, " ").trim();
  return text.slice(0, 10000) || job.title;
}

/** schema.org JobPosting for Google for Jobs (JSON-LD). */
export function buildJobPostingJsonLd(job: JobListingSeo): Record<string, unknown> {
  const jobUrl = absoluteUrl(`/jobs/${job.id}`);
  const applyUrl = absoluteUrl(`/jobs/${job.id}/apply`);

  return {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    "@id": `${jobUrl}#jobposting`,
    title: job.title,
    description: plainDescription(job),
    datePosted: job.created_at,
    hiringOrganization: {
      "@type": "Organization",
      name: companyName(job),
    },
    directApply: true,
    identifier: {
      "@type": "PropertyValue",
      name: "OpenScout job id",
      value: job.id,
    },
    url: jobUrl,
    applicationUrl: applyUrl,
    jobLocationType: "TELECOMMUTE",
  };
}
