import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle, AlertCircle, Briefcase } from "lucide-react";
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
      <div className="py-16">
        <Container>
          <div className="mx-auto max-w-md rounded-[10px] border border-[var(--border)] bg-white p-8 text-center shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
            <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Temporarily unavailable</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
              Shared interview links require configuration. Please try again later.
            </p>
            <Link href="/" className="mt-6 inline-block">
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
    <div className="py-12">
      <Container>
        <div className="mx-auto max-w-xl">
          <div className="mb-8 text-center">
            <Link href="/" className="text-sm font-medium" style={{ color: "var(--primary)" }}>
              OpenScout
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-zinc-100">Interview result</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
              Shared highlights only — no transcript or private account details.
            </p>
            {sharedByFirst && (
              <p className="mt-2 text-sm text-gray-600 dark:text-zinc-300">Shared by {sharedByFirst}</p>
            )}
          </div>

          <div className="rounded-[10px] border border-[var(--border)] bg-white shadow-card dark:border-white/[0.06] dark:bg-zinc-900 overflow-hidden">
            <div
              className="border-b border-[var(--border)] px-6 py-4"
              style={{ backgroundColor: "var(--primary-muted)" }}
            >
              <div className="flex flex-wrap items-center gap-4 sm:justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white tabular-nums"
                    style={{ backgroundColor: circleColor }}
                  >
                    {data.score}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-zinc-400">Role</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Briefcase className="h-4 w-4 text-gray-500 dark:text-zinc-400" aria-hidden />
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

            <div className="border-b border-[var(--border)] px-6 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                Overall score
              </p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-zinc-100">
                {data.score}/100
              </p>
            </div>

            {data.strengths.length > 0 && (
              <div className="border-t border-[var(--border)] px-6 py-4">
                <h3 className="font-semibold text-gray-800 dark:text-zinc-100">Strengths</h3>
                <ul className="mt-2 space-y-2">
                  {data.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-zinc-300">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" aria-hidden />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.improvements.length > 0 && (
              <div className="border-t border-[var(--border)] px-6 py-4">
                <h3 className="font-semibold text-gray-800 dark:text-zinc-100">Areas to improve</h3>
                <ul className="mt-2 space-y-2">
                  {data.improvements.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-zinc-300">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
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
            />
          </div>

          <p className="mt-6 text-center text-xs text-gray-400 dark:text-zinc-500">
            Practice with AI interviews on{" "}
            <Link href="/mock-interview" className="underline">
              OpenScout
            </Link>
            .
          </p>
        </div>
      </Container>
    </div>
  );
}
