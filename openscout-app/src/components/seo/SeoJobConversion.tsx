"use client";

import Link from "next/link";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";
import { seoMockInterviewHref } from "@/lib/seo/conversion-links";

export type SeoPageType = "interview-questions" | "salary" | "resume-examples" | "skills";

export type SeoCtaPosition = "top" | "mid" | "bottom" | "sticky";

function trackSeoCta(jobSlug: string, pageType: SeoPageType, position: SeoCtaPosition) {
  trackClient(ANALYTICS_EVENTS.seo_cta_clicked, {
    job: jobSlug,
    page_type: pageType,
    position,
  });
}

function TrustRow() {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-zinc-500">
      <li className="flex items-center gap-1.5">
        <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden />
        Real interview questions
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden />
        Instant feedback
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden />
        Used by job seekers
      </li>
    </ul>
  );
}

type CtaBlockProps = {
  jobSlug: string;
  pageType: SeoPageType;
  position: Exclude<SeoCtaPosition, "sticky">;
  headline: string;
  buttonLabel: string;
};

export function SeoCtaBlock({ jobSlug, pageType, position, headline, buttonLabel }: CtaBlockProps) {
  const href = seoMockInterviewHref(jobSlug);
  return (
    <aside
      className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900"
      aria-label="Practice with AI interview"
    >
      <p className="text-base font-medium text-gray-900 dark:text-zinc-100">{headline}</p>
      <TrustRow />
      <Link
        href={href}
        onClick={() => trackSeoCta(jobSlug, pageType, position)}
        className="mt-4 inline-flex items-center justify-center rounded-[10px] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
      >
        {buttonLabel}
      </Link>
    </aside>
  );
}

type StickyProps = { jobSlug: string; pageType: SeoPageType };

export function SeoStickyInterviewCta({ jobSlug, pageType }: StickyProps) {
  const href = seoMockInterviewHref(jobSlug);
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-40 hidden md:block">
      <Link
        href={href}
        onClick={() => trackSeoCta(jobSlug, pageType, "sticky")}
        className="pointer-events-auto inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-gray-900 shadow-lg transition-colors hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        Try AI Interview
      </Link>
    </div>
  );
}
