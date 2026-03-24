import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CvAnalysisShareCardSection } from "@/components/share/CvAnalysisShareCardSection";

type PageProps = {
  params: Promise<{ analysisId: string }>;
};

type CvAnalysisRow = {
  id: string;
  created_at: string;
  job_category: string | null;
  overall_score: number | null;
  category_scores: unknown;
  strengths: unknown;
  improvements: unknown;
};

function scoreEntries(value: unknown): Array<{ key: string; value: number }> {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => typeof v === "number")
    .map(([k, v]) => ({ key: k.replaceAll("_", " "), value: v as number }));
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export default async function CvAnalysisDetailPage({ params }: PageProps) {
  const { analysisId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
  if (profile?.role === "employer") redirect("/employer");

  const { data } = await supabase
    .from("cv_analyses")
    .select("id, created_at, job_category, overall_score, category_scores, strengths, improvements")
    .eq("id", analysisId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data?.id) notFound();

  const row = data as CvAnalysisRow;
  const scores = scoreEntries(row.category_scores);
  const strengths = stringList(row.strengths);
  const improvements = stringList(row.improvements);
  const shortInsight = strengths[0] || improvements[0] || "CV readiness snapshot";
  const safeScore = typeof row.overall_score === "number" ? row.overall_score : 0;
  const firstNameFromMeta =
    typeof user.user_metadata?.first_name === "string"
      ? user.user_metadata.first_name
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name.split(/\s+/)[0]
        : undefined;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/dashboard"
        className="text-sm text-gray-500 hover:underline dark:text-zinc-400 dark:hover:text-zinc-300"
      >
        ← Back to dashboard
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-zinc-100">CV analysis result</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">
        {row.job_category?.trim() || "General"} ·{" "}
        {row.created_at ? new Date(row.created_at).toLocaleString() : "Recent"}
      </p>

      <section className="os-surface-card mt-6 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400">
          Overall score
        </h2>
        <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
          {typeof row.overall_score === "number" ? row.overall_score : "—"}
        </p>
      </section>

      <div className="mt-6">
        <CvAnalysisShareCardSection
          role={row.job_category?.trim() || "General"}
          score={safeScore}
          insight={shortInsight}
          firstName={firstNameFromMeta}
        />
      </div>

      <section className="os-surface-card mt-6 p-6">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Category scores</h2>
        {scores.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No category scores available.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {scores.map((entry) => (
              <li
                key={entry.key}
                className="rounded-[10px] border border-zinc-200/80 bg-[#FDFDFC] px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/80"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm capitalize text-zinc-700 dark:text-zinc-300">{entry.key}</span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {entry.value}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="os-surface-card mt-6 p-6">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Strengths</h2>
        {strengths.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No strengths recorded.</p>
        ) : (
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
            {strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="os-surface-card mt-6 p-6">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Improvements</h2>
        {improvements.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No improvements recorded.</p>
        ) : (
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
            {improvements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
