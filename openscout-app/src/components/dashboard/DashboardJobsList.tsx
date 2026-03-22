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
        transition: { duration: 0.6, ease: editorialEase },
      },
    }),
    [reduceMotion]
  );

  return (
    <motion.div
      className={cn(
        "overflow-hidden rounded-xl border border-[#eaeaea] bg-white",
        "dark:border-zinc-800 dark:bg-zinc-950"
      )}
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <ul className="divide-y divide-[#eaeaea] dark:divide-zinc-800">
        {jobs.map((job) => {
          const posted = formatPosted(job.postedAt);
          return (
            <motion.li key={job.id} variants={rowVariants}>
              <Link
                href={`/dashboard/jobs/${job.id}`}
                className={cn(
                  "group block px-6 py-7 transition-[background-color,box-shadow] duration-200 sm:px-8 sm:py-8",
                  "hover:bg-[#f9f9f8] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
                  "active:scale-[0.99] dark:hover:bg-zinc-900/80 dark:hover:shadow-none",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 focus-visible:ring-inset dark:focus-visible:ring-zinc-500"
                )}
              >
                <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-10">
                  <div className="min-w-0 space-y-3">
                    <span className="inline-flex max-w-full rounded-full bg-[#e1f3fe] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-[#1f6c9f] dark:bg-sky-950/50 dark:text-sky-200">
                      <span className="truncate">{job.companyName}</span>
                    </span>
                    <h2 className="text-lg font-semibold leading-tight tracking-tight text-[#111111] dark:text-zinc-50 md:text-xl">
                      {job.title}
                    </h2>
                    {job.description ? (
                      <p className="line-clamp-2 max-w-[65ch] text-sm leading-[1.6] text-[#787774] dark:text-zinc-400">
                        {job.description}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 pt-0.5 font-mono text-xs text-[#787774] dark:text-zinc-500">
                      {posted ? (
                        <span>
                          Posted{" "}
                          <time dateTime={job.postedAt ?? undefined} className="tabular-nums text-[#2f3437] dark:text-zinc-300">
                            {posted}
                          </time>
                        </span>
                      ) : null}
                      {job.minCvScore != null ? (
                        <span>
                          Min. CV{" "}
                          <span className="tabular-nums text-[#2f3437] dark:text-zinc-300">{job.minCvScore}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex md:justify-end">
                    <span
                      className={cn(
                        "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-medium",
                        "bg-[#111111] text-white transition-colors duration-200",
                        "group-hover:bg-[#333333] dark:bg-zinc-100 dark:text-[#111111] dark:group-hover:bg-white"
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
