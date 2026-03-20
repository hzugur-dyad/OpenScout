import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jobs",
  description: "Browse active job listings on OpenScout — AI-powered CV fit and interviews.",
  alternates: {
    canonical: "/jobs",
  },
};

export default function MarketingJobsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
