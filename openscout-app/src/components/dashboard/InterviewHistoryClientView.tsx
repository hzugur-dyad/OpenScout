"use client";

import Link from "next/link";
import { Newsreader } from "next/font/google";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarBlank,
  CaretDown,
  CaretUp,
  ChartLineUp,
  Minus,
  Tag,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { InterviewScoreTrend } from "@/lib/interview-history-trend";
import { SharePublicProfileButton } from "@/components/dashboard/SharePublicProfileButton";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600"],
});

const editorialEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

const revealTransition = (delay = 0) => ({
  duration: 0.6,
  ease: editorialEase,
  delay,
});

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-48px" }}
      transition={revealTransition(delay)}
    >
      {children}
    </motion.div>
  );
}

const primaryCtaClass =
  "!rounded-md !bg-[#111111] !text-white hover:!bg-[#333333] dark:!bg-zinc-100 dark:!text-[#111111] dark:hover:!bg-white";

const surfaceCard =
  "rounded-xl border border-[#EAEAEA] bg-white transition-[box-shadow] duration-200 dark:border-zinc-800 dark:bg-[#141312] dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.2)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]";

export type InterviewHistoryRow = {
  id: string;
  job_category: string;
  created_at: string;
  score: number | null;
  hiringScore: number;
  resultHref: string;
};

export type InterviewHistoryClientViewProps = {
  rows: InterviewHistoryRow[];
  trendScores: number[];
  trend: InterviewScoreTrend;
  arrow: "↑" | "↓" | "→";
  bestInterviewScore: number;
  bestHiringScore: number;
};

function formatInterviewDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function trendPresentation(trend: InterviewScoreTrend): {
  chipClass: string;
  iconClass: string;
} {
  if (trend === "Improving") {
    return {
      chipClass: "border-[#EDF3EC] bg-[#EDF3EC] dark:border-emerald-950/40 dark:bg-emerald-950/25",
      iconClass: "text-[#346538] dark:text-emerald-400",
    };
  }
  if (trend === "Declining") {
    return {
      chipClass: "border-[#FDEBEC] bg-[#FDEBEC] dark:border-red-950/40 dark:bg-red-950/20",
      iconClass: "text-[#9F2F2D] dark:text-red-400",
    };
  }
  return {
    chipClass: "border-[#EAEAEA] bg-[#F7F6F3] dark:border-zinc-800 dark:bg-zinc-900/60",
    iconClass: "text-[#787774] dark:text-zinc-400",
  };
}

export function InterviewHistoryClientView({
  rows,
  trendScores,
  trend,
  arrow,
  bestInterviewScore,
  bestHiringScore,
}: InterviewHistoryClientViewProps) {
  const TrendIcon = arrow === "↑" ? CaretUp : arrow === "↓" ? CaretDown : Minus;
  const { chipClass: trendChipClass, iconClass: trendIconClass } = trendPresentation(trend);
  const trendLabelClass =
    trend === "Improving"
      ? "text-[#346538] dark:text-emerald-400"
      : trend === "Declining"
        ? "text-[#9F2F2D] dark:text-red-400"
        : "text-[#2F3437] dark:text-zinc-200";

  return (
    <div className="relative -mx-4 min-h-full overflow-x-clip bg-[#F7F6F3] px-4 pb-24 pt-10 lg:-mx-8 lg:px-8 dark:bg-zinc-950">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[#F7F6F3] [background-image:radial-gradient(ellipse_90%_60%_at_50%_-30%,rgba(251,243,219,0.38),transparent_58%)] dark:bg-zinc-950 dark:[background-image:radial-gradient(ellipse_75%_50%_at_50%_-20%,rgba(253,235,236,0.06),transparent_55%)]"
      />

      <div className="relative mx-auto w-full max-w-5xl">
        <Reveal>
          <header>
            <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-zinc-500">
              Practice log
            </p>
            <div className="mt-4 flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
              <h1
                className={`min-w-0 flex-1 text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-[#111111] md:text-[2.5rem] lg:pr-8 dark:text-zinc-100 ${newsreader.className}`}
              >
                Interview history
              </h1>
              <div className="flex w-full shrink-0 flex-col items-end gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:pt-1">
                <SharePublicProfileButton variant="outline" size="sm" />
                <Link href="/mock-interview" className="block w-auto sm:contents">
                  <Button
                    variant="primary"
                    size="sm"
                    className={primaryCtaClass}
                    icon={ArrowRight}
                    iconPosition="right"
                  >
                    New practice run
                  </Button>
                </Link>
              </div>
            </div>
            <p className="mt-6 max-w-[65ch] text-base leading-[1.6] text-[#787774] dark:text-zinc-400">
              Mock interviews you have finished, the score trend from your last five runs, and links to each report.
            </p>
            {rows.length > 0 && (
              <p className="mt-5 text-sm tabular-nums text-[#787774] dark:text-zinc-500">
                {rows.length} session{rows.length === 1 ? "" : "s"} on file
              </p>
            )}
          </header>
        </Reveal>

        {rows.length === 0 ? (
            <Reveal delay={0.08}>
            <EmptyState
              className="mt-20 border-solid border-[#EAEAEA] bg-white py-16 dark:border-zinc-800 dark:bg-[#141312]"
              iconName="messageCircle"
              title="No interviews yet"
              description="Run a mock interview once to unlock scores, a trend line, and this list."
            >
              <Link href="/mock-interview">
                <Button variant="primary" size="sm" className={primaryCtaClass}>
                  Start your first interview
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-md border-[#EAEAEA] dark:border-zinc-700"
                >
                  Back to dashboard
                </Button>
              </Link>
            </EmptyState>
          </Reveal>
        ) : (
          <div className="mt-14 space-y-12">
            <Reveal delay={0.06}>
              <section className="overflow-hidden rounded-xl border border-[#EAEAEA] dark:border-zinc-800">
                <div className="grid gap-px bg-[#EAEAEA] dark:bg-zinc-800 lg:grid-cols-5">
                  <div className="bg-white p-8 dark:bg-[#141312] lg:col-span-3 lg:p-10">
                    <div className="flex flex-wrap items-center gap-2">
                      <ChartLineUp className="h-5 w-5 text-[#787774] dark:text-zinc-500" weight="bold" aria-hidden />
                      <h2 className="text-sm font-semibold tracking-tight text-[#111111] dark:text-zinc-100">
                        Performance snapshot
                      </h2>
                    </div>
                    <p className="mt-3 text-sm leading-[1.6] text-[#787774] dark:text-zinc-400">
                      Overall scores from up to five attempts, oldest to newest. With two or more scores, the trend compares
                      the first and last in that window.
                    </p>

                    <div
                      className="mt-8 flex flex-wrap gap-2"
                      aria-label="Recent overall scores in chronological order"
                    >
                      {trendScores.map((s, i) => (
                        <motion.span
                          key={`${s}-${i}`}
                          initial={{ opacity: 0, y: 8 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ ...revealTransition(i * 0.08), duration: 0.45 }}
                          className="inline-flex min-h-9 min-w-[2.75rem] items-center justify-center rounded border border-[#EAEAEA] bg-[#F7F6F3] px-3 font-mono text-sm tabular-nums text-[#111111] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        >
                          {s}
                        </motion.span>
                      ))}
                    </div>

                    <div
                      className={`mt-8 inline-flex items-center gap-3 rounded-md border px-4 py-3 ${trendChipClass}`}
                    >
                      <TrendIcon className={`h-5 w-5 shrink-0 ${trendIconClass}`} weight="bold" aria-hidden />
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-zinc-500">
                          Trend
                        </p>
                        <p className={`text-sm font-semibold tabular-nums ${trendLabelClass}`}>{trend}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col divide-y divide-[#EAEAEA] bg-white dark:divide-zinc-800 dark:bg-[#141312] lg:col-span-2">
                    <div className="flex flex-1 flex-col justify-center p-8 lg:p-10">
                      <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-zinc-500">
                        Best interview score
                      </p>
                      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-[#111111] dark:text-zinc-100">
                        {bestInterviewScore}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-[#787774] dark:text-zinc-500">
                        Peak overall across all runs
                      </p>
                    </div>
                    <div className="flex flex-1 flex-col justify-center p-8 lg:p-10">
                      <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-zinc-500">
                        Best hiring score
                      </p>
                      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-[#111111] dark:text-zinc-100">
                        {bestHiringScore}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-[#787774] dark:text-zinc-500">
                        Strongest composite from report data
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </Reveal>

            <Reveal delay={0.1}>
              <section>
                <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <h2 className="text-sm font-semibold tracking-tight text-[#111111] dark:text-zinc-100">All sessions</h2>
                  <p className="text-xs text-[#787774] dark:text-zinc-500">Sorted newest first</p>
                </div>

                <div className={`overflow-hidden ${surfaceCard}`}>
                  <div className="hidden md:block">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-[#EAEAEA] bg-[#FBFBFA] dark:border-zinc-800 dark:bg-zinc-900/80">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-zinc-500">
                            Role / category
                          </th>
                          <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-zinc-500">
                            Date
                          </th>
                          <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-zinc-500">
                            Overall
                          </th>
                          <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-zinc-500">
                            Hiring score
                          </th>
                          <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-zinc-500">
                            Result
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EAEAEA] dark:divide-zinc-800">
                        {rows.map((r) => {
                          const overall = typeof r.score === "number" ? r.score : "—";
                          return (
                            <tr
                              key={r.id}
                              className="transition-[background-color,box-shadow] duration-200 hover:bg-[#FBFBFA] hover:shadow-[0_2px_8px_rgba(0,0,0,0.03)] dark:hover:bg-zinc-900/50 dark:hover:shadow-none"
                            >
                              <td className="px-6 py-4 font-medium text-[#111111] dark:text-zinc-100">{r.job_category}</td>
                              <td className="px-6 py-4 tabular-nums text-[#787774] dark:text-zinc-400">
                                {formatInterviewDate(r.created_at)}
                              </td>
                              <td className="px-6 py-4 font-mono tabular-nums text-[#111111] dark:text-zinc-100">{overall}</td>
                              <td className="px-6 py-4 font-mono tabular-nums text-[#111111] dark:text-zinc-100">
                                {r.hiringScore}
                              </td>
                              <td className="px-6 py-4">
                                <Link
                                  href={r.resultHref}
                                  className="group inline-flex items-center gap-1.5 text-sm font-medium text-[#111111] underline decoration-[#EAEAEA] underline-offset-4 transition-colors hover:decoration-[#111111] dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-300"
                                >
                                  View result
                                  <ArrowRight
                                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                                    weight="bold"
                                    aria-hidden
                                  />
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <ul className="divide-y divide-[#EAEAEA] md:hidden dark:divide-zinc-800">
                    {rows.map((r, idx) => {
                      const overall = typeof r.score === "number" ? r.score : "—";
                      return (
                        <motion.li
                          key={r.id}
                          initial={{ opacity: 0, y: 10 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: "-24px" }}
                          transition={revealTransition(idx * 0.05)}
                          className="p-6 transition-colors active:bg-[#FBFBFA] dark:active:bg-zinc-900/40"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 text-[#111111] dark:text-zinc-100">
                                <Tag className="h-4 w-4 shrink-0 text-[#787774] dark:text-zinc-500" weight="bold" aria-hidden />
                                <span className="truncate font-medium">{r.job_category}</span>
                              </div>
                              <div className="mt-2 flex items-center gap-1.5 text-xs tabular-nums text-[#787774] dark:text-zinc-500">
                                <CalendarBlank className="h-3.5 w-3.5 shrink-0" weight="bold" aria-hidden />
                                {formatInterviewDate(r.created_at)}
                              </div>
                              <div className="mt-4 flex gap-8 font-mono text-sm tabular-nums">
                                <div>
                                  <span className="block text-[10px] font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-zinc-500">
                                    Overall
                                  </span>
                                  <span className="font-semibold text-[#111111] dark:text-zinc-100">{overall}</span>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-zinc-500">
                                    Hiring
                                  </span>
                                  <span className="font-semibold text-[#111111] dark:text-zinc-100">{r.hiringScore}</span>
                                </div>
                              </div>
                            </div>
                            <Link
                              href={r.resultHref}
                              className="inline-flex shrink-0 items-center justify-center rounded-md border border-[#EAEAEA] bg-white p-2.5 text-[#111111] transition-[transform,box-shadow] duration-200 active:scale-[0.98] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-zinc-700 dark:bg-[#141312] dark:text-zinc-100 dark:hover:shadow-none"
                              aria-label={`View result for ${r.job_category}`}
                            >
                              <ArrowRight className="h-5 w-5" weight="bold" aria-hidden />
                            </Link>
                          </div>
                        </motion.li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            </Reveal>
          </div>
        )}
      </div>
    </div>
  );
}
