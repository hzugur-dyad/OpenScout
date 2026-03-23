"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Briefcase, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { ScoutPassSharePanel } from "@/components/marketing/ScoutPassSharePanel";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import type { ScoutPassData } from "@/lib/types";

export default function ScoutPassPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<ScoutPassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"not_found" | "unavailable" | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError("not_found");
      return;
    }
    fetch(`/api/scout-pass/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (res.status === 503) {
          setError("unavailable");
          return null;
        }
        if (!res.ok) {
          setError("not_found");
          return null;
        }
        return res.json();
      })
      .then((d) => d && setData(d))
      .catch(() => setError("not_found"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="os-public-canvas flex min-h-[50dvh] items-center justify-center py-16">
        <Container>
          <div className="os-public-card mx-auto max-w-md space-y-4 p-8" aria-busy="true" aria-label="Loading Scout Pass">
            <SkeletonBlock className="mx-auto h-8 w-40" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-32 w-full rounded-xl" />
          </div>
        </Container>
      </div>
    );
  }

  if (error || !data) {
    const isUnavailable = error === "unavailable";
    return (
      <div className="os-public-canvas py-20">
        <Container>
          <div className="os-public-card mx-auto max-w-md p-10 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {isUnavailable ? "Scout Pass temporarily unavailable" : "Scout Pass not found"}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {isUnavailable
                ? "Scout Pass links are temporarily unavailable. Please try again later."
                : "This link may be invalid or the credential may have been removed."}
            </p>
            <Link href="/" className="mt-8 inline-block">
              <Button variant="outline">Go to OpenScout</Button>
            </Link>
          </div>
        </Container>
      </div>
    );
  }

  const report = data.report || {};
  const strengths = report.strengths ?? [];
  const improvements = report.improvements ?? [];

  return (
    <div className="os-public-canvas py-16 md:py-20">
      <Container className="px-5 sm:px-6">
      <div className="mx-auto max-w-xl">
        <div className="mb-10 text-center">
          <Link href="/" className="text-sm font-semibold tracking-wide text-primary transition-opacity hover:opacity-80">
            OpenScout
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Scout Score</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            AI-verified credential · One interview, many companies
          </p>
        </div>

        <div className="os-public-card">
          <div
            className="border-b border-[var(--border)] px-6 py-4"
            style={{ backgroundColor: "var(--primary-muted)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--primary)" }}
              >
                <Briefcase className="h-6 w-6 text-white" weight="regular" aria-hidden />
              </div>
              <div>
                <p className="text-sm text-gray-500">Role</p>
                <p className="font-semibold">{data.job_category}</p>
                {data.display_name && (
                  <p className="text-sm text-gray-600">{data.display_name}</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-6">
            <div className="rounded-xl border border-[var(--border)] bg-zinc-50/60 p-4 text-center dark:border-white/[0.08] dark:bg-zinc-950/40">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">CV Score</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {data.cv_score != null ? `${data.cv_score}` : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-zinc-50/60 p-4 text-center dark:border-white/[0.08] dark:bg-zinc-950/40">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">Interview Score</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {data.interview_score != null ? `${data.interview_score}` : "—"}
              </p>
            </div>
          </div>

          {strengths.length > 0 && (
            <div className="border-t border-[var(--border)] px-6 py-5 dark:border-white/[0.08]">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Strengths</h3>
              <ul className="mt-2 space-y-1">
                {strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" weight="regular" aria-hidden />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {improvements.length > 0 && (
            <div className="border-t border-[var(--border)] px-6 py-5 dark:border-white/[0.08]">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Areas to improve</h3>
              <ul className="mt-2 space-y-1">
                {improvements.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <WarningCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" weight="regular" aria-hidden />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <ScoutPassSharePanel slug={slug} jobCategory={data.job_category} />

        <div className="os-public-card mt-10 p-8 text-center">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Earn your own Scout Score</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Run one AI mock interview on OpenScout and unlock a pass you can attach to applications—same verified format
            as this page.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register">
              <Button variant="primary">Create free account</Button>
            </Link>
            <Link href="/mock-interview">
              <Button variant="outline">Start mock interview</Button>
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Credentials are issued by OpenScout after AI evaluation. Transcripts stay private.
        </p>
      </div>
      </Container>
    </div>
  );
}
