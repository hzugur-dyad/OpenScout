"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type DashboardJobRow = {
  id: string;
  title: string;
  description: string | null;
  minCvScore: number | null;
  companyName: string;
  postedAt: string | null;
};

const editorialEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

function formatPosted(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function DashboardJobsList({ jobs }: { jobs: DashboardJobRow[] }) {
  const reduceMotion = useReducedMotion();
  const containerVariants = useMemo(
    () => ({
      hidden: { opacity: reduceMotion ? 1 : 0 },
      show: {
        opacity: 1,
        transition: {
          staggerChildren: reduceMotion ? 0 : 0.08,
          delayChildren: reduceMotion ? 0 : 0.02,
        },
      },
    }),
    [reduceMotion]
  );
  const rowVariants = useMemo(
    () => ({
      hidden: reduceMotion
        ? { opacity: 1, y: 0 }
        : { opacity: 0, y: 12 },
      show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.32, ease: editorialEase },
      },
    }),
    [reduceMotion]
  );

  return (
    <motion.div
      className="mt-2"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <ul
        className="space-y-3"
        aria-labelledby="dashboard-jobs-title"
      >
        {jobs.map((job) => {
          const posted = formatPosted(job.postedAt);
          return (
            <motion.li key={job.id} variants={rowVariants}>
              <Link
                href={`/dashboard/jobs/${job.id}`}
                className={cn(
                  "group block touch-manipulation rounded-[10px] border border-white/75 bg-white/60 px-6 py-8 backdrop-blur-xl ring-1 ring-black/[0.04] transition-[background-color,transform,border-color] duration-200 ease-out sm:px-8",
                  "hover:border-white/85 hover:bg-white/66 active:bg-white/62 dark:border-white/[0.12] dark:bg-black/45 dark:backdrop-blur-xl dark:ring-white/[0.03] dark:hover:border-white/[0.18] dark:hover:bg-black/55 dark:active:bg-black/60",
                  "motion-reduce:active:scale-100 active:scale-[0.99]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset dark:focus-visible:ring-zinc-500"
                )}
              >
                <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-10">
                  <div className="min-w-0 space-y-3">
                    <span className="inline-flex max-w-full rounded-full bg-[#e8f4fa] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-[#1a5f8a] dark:bg-sky-950/45 dark:text-sky-200/95">
                      <span className="truncate">{job.companyName}</span>
                    </span>
                    <h2 className="text-lg font-medium leading-[1.25] tracking-tight text-[#111111] dark:text-zinc-50 md:text-xl">
                      {job.title}
                    </h2>
                    {job.description ? (
                      <p className="line-clamp-2 max-w-[65ch] text-sm leading-[1.5] text-[#111111]/60 dark:text-zinc-400">
                        {job.description}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 pt-1 font-mono text-xs text-[#111111]/72 dark:text-zinc-500">
                      {posted ? (
                        <span>
                          Posted{" "}
                          <time dateTime={job.postedAt ?? undefined} className="tabular-nums text-[#111111] dark:text-zinc-300">
                            {posted}
                          </time>
                        </span>
                      ) : null}
                      {job.minCvScore != null ? (
                        <span>
                          Min. CV{" "}
                          <span className="tabular-nums text-[#111111] dark:text-zinc-300">{job.minCvScore}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex md:justify-end">
                    <span
                      className={cn(
                        "inline-flex h-10 shrink-0 items-center gap-2 rounded-consistent px-4 text-sm font-medium",
                        "bg-[#111111] text-white transition-colors duration-200 ease-out",
                        "group-hover:bg-[#2a2a2a] group-active:bg-[#1a1a1a] dark:bg-zinc-100 dark:text-[#111111] dark:group-hover:bg-white dark:group-active:bg-zinc-200"
                      )}
                    >
                      View role
                      <CaretRight className="size-4 opacity-90" weight="bold" aria-hidden />
                    </span>
                  </div>
                </div>
              </Link>
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
}
