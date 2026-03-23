import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  RscBriefcaseIcon,
  RscCheckCircleIcon,
  RscWarningCircleIcon,
} from "@/components/icons/PhosphorRscIcons";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { HiringFitBadge } from "@/components/employer/HiringFitBadge";
import { InterviewResultShareBlock } from "@/components/mock-interview/InterviewResultShareBlock";
import {
  fetchPublicMockInterviewById,
  fetchSharedByFirstNameForResultId,
} from "@/lib/public-mock-interview-result";
import { interviewResultViralText } from "@/lib/share-interview-result";
import { absoluteUrl } from "@/lib/seo/site";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ anon?: string | string[] }>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const sp = await searchParams;
  const anonRaw = sp?.anon;
  const anon = anonRaw === "1" || (Array.isArray(anonRaw) && anonRaw.includes("1"));
  const fetched = await fetchPublicMockInterviewById(id);
  if (fetched.status !== "ok") {
    return { title: "Interview result", robots: { index: false, follow: false } };
  }
  const { score, job_category } = fetched.data;
  const title = `${score}/100 · ${job_category || "Interview"} | OpenScout`;
  const description = interviewResultViralText(score, job_category);
  const ogPath = `/api/og/result/${encodeURIComponent(id.trim())}`;
  const ogUrl = absoluteUrl(ogPath);
  const pagePath = `/result/${encodeURIComponent(id.trim())}${anon ? "?anon=1" : ""}`;
  return {
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: "website",
      url: absoluteUrl(pagePath),
      images: [{ url: ogUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
    },
  };
}

export default async function PublicInterviewResultPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const anonRaw = sp?.anon;
  const anon = anonRaw === "1" || (Array.isArray(anonRaw) && anonRaw.includes("1"));

  const fetched = await fetchPublicMockInterviewById(id);
  if (fetched.status === "invalid") {
    notFound();
  }
  if (fetched.status === "unavailable") {
    return (
      <div className="os-public-canvas py-20">
        <Container>
          <div className="os-public-card mx-auto max-w-md p-10 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Temporarily unavailable</h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Shared interview links require configuration. Please try again later.
            </p>
            <Link href="/" className="mt-8 inline-block">
              <Button variant="outline">Go to OpenScout</Button>
            </Link>
          </div>
        </Container>
      </div>
    );
  }
  if (fetched.status === "not_found") {
    notFound();
  }

  const data = fetched.data;
  let sharedByFirst: string | null = null;
  if (!anon) {
    sharedByFirst = await fetchSharedByFirstNameForResultId(id.trim());
  }

  const circleColor =
    data.score >= 70 ? "#22c55e" : data.score >= 50 ? "#D4A843" : "#ef4444";

  return (
    <div className="os-public-canvas py-16 md:py-20">
      <Container className="px-5 sm:px-6">
        <div className="mx-auto max-w-xl">
          <div className="mb-10 text-center">
            <Link
              href="/"
              className="text-sm font-semibold tracking-wide text-primary transition-opacity hover:opacity-80"
            >
              OpenScout
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Interview result
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Shared highlights only — no transcript or private account details.
            </p>
            {sharedByFirst && (
              <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">Shared by {sharedByFirst}</p>
            )}
          </div>

          <div className="os-public-card">
            <div
              className="border-b border-[var(--border)] px-6 py-5 dark:border-white/[0.08]"
              style={{ backgroundColor: "var(--primary-muted)" }}
            >
              <div className="flex flex-wrap items-center gap-4 sm:justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-lg tabular-nums ring-2 ring-white/20"
                    style={{ backgroundColor: circleColor }}
                  >
                    {data.score}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-zinc-400">Role</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <RscBriefcaseIcon className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                      <p className="font-semibold text-gray-900 dark:text-zinc-100">
                        {data.job_category || "—"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-1 sm:items-end">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                    Hiring score
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-zinc-100">
                    {data.hiringScore}
                  </p>
                  <HiringFitBadge tag={data.fitTag} />
                </div>
              </div>
            </div>

            <div className="border-b border-[var(--border)] bg-zinc-50/50 px-6 py-5 dark:border-white/[0.08] dark:bg-zinc-950/30">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                Overall score
              </p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {data.score}/100
              </p>
            </div>

            {data.strengths.length > 0 && (
              <div className="border-t border-[var(--border)] px-6 py-5 dark:border-white/[0.08]">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Strengths</h3>
                <ul className="mt-2 space-y-2">
                  {data.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-zinc-300">
                      <RscCheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.improvements.length > 0 && (
              <div className="border-t border-[var(--border)] px-6 py-5 dark:border-white/[0.08]">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Areas to improve</h3>
                <ul className="mt-2 space-y-2">
                  {data.improvements.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-zinc-300">
                      <RscWarningCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-6">
            <InterviewResultShareBlock
              resultId={id.trim()}
              score={data.score}
              jobCategory={data.job_category}
              showAnonToggle={false}
              surface="public_result_page"
            />
          </div>

          <div className="os-public-card mt-10 p-8 text-center">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Get your own verified result
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Practice a role-specific AI interview, receive a score and Scout Pass, and share a public
              scorecard—without exposing your transcript.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/register">
                <Button variant="primary">Create free account</Button>
              </Link>
              <Link href="/mock-interview">
                <Button variant="outline">Try a mock interview</Button>
              </Link>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
            OpenScout — AI mock interviews and candidate profiles employers can trust.
          </p>
        </div>
      </Container>
    </div>
  );
}
