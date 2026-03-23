"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Briefcase, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
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
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    const isUnavailable = error === "unavailable";
    return (
      <div className="py-16">
        <Container>
        <div className="mx-auto max-w-md rounded-[10px] border border-[var(--border)] bg-white p-8 text-center shadow-soft dark:border-white/[0.12] dark:bg-black/25 dark:backdrop-blur-xl">
          <h1 className="text-xl font-bold">
            {isUnavailable ? "Scout Pass temporarily unavailable" : "Scout Pass not found"}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {isUnavailable
              ? "Scout Pass links are temporarily unavailable. Please try again later."
              : "This link may be invalid or the credential may have been removed."}
          </p>
          <Link href="/" className="mt-6 inline-block">
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
    <div className="py-12">
      <Container>
      <div className="mx-auto max-w-xl">
        <div className="mb-8 text-center">
          <Link href="/" className="text-sm font-medium" style={{ color: "var(--primary)" }}>
            OpenScout
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Scout Score</h1>
          <p className="mt-1 text-sm text-gray-500">
            AI-verified credential · One interview, many companies
          </p>
        </div>

        <div className="rounded-[10px] border border-[var(--border)] bg-white shadow-card overflow-hidden dark:border-white/[0.12] dark:bg-black/25 dark:backdrop-blur-xl">
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
            <div className="rounded-lg border border-[var(--border)] p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">CV Score</p>
              <p className="mt-1 text-2xl font-bold">
                {data.cv_score != null ? `${data.cv_score}` : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Interview Score</p>
              <p className="mt-1 text-2xl font-bold">
                {data.interview_score != null ? `${data.interview_score}` : "—"}
              </p>
            </div>
          </div>

          {strengths.length > 0 && (
            <div className="border-t border-[var(--border)] px-6 py-4">
              <h3 className="font-semibold text-gray-800">Strengths</h3>
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
            <div className="border-t border-[var(--border)] px-6 py-4">
              <h3 className="font-semibold text-gray-800">Areas to improve</h3>
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

        <p className="mt-6 text-center text-xs text-gray-400">
          This credential was issued by OpenScout. Get your own Scout Score at{" "}
          <Link href="/" className="underline">openscout.com</Link>.
        </p>
      </div>
      </Container>
    </div>
  );
}
