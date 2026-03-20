import type { Metadata } from "next";
import { fetchActiveJobForSeo } from "@/lib/seo/jobs-fetch";
import { buildJobApplyMetadata } from "@/lib/seo/job-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ jobId: string }>;
}): Promise<Metadata> {
  const { jobId } = await params;
  const job = await fetchActiveJobForSeo(jobId);
  if (!job) {
    return {
      title: "Job not found",
      robots: { index: false, follow: false },
    };
  }
  return buildJobApplyMetadata(job);
}

export default function JobApplyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
