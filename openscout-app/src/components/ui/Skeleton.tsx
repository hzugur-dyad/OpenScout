"use client";

import { cn } from "@/lib/utils";

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "skeleton-shimmer rounded-lg bg-zinc-200/90 dark:bg-zinc-700/85",
        className
      )}
    />
  );
}

/** Full-width analysis result placeholder while AI runs */
export function CVAnalysisLoadingSkeleton() {
  return (
    <div className="mt-8 space-y-6" aria-busy="true" aria-label="Analyzing CV">
      <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
        <SkeletonBlock className="mb-4 h-5 w-40" />
        <div className="grid gap-3 sm:grid-cols-2">
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-[75%]" />
          <SkeletonBlock className="h-4 w-full" />
        </div>
        <SkeletonBlock className="mt-4 h-16 w-full" />
      </div>
      <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
        <div className="flex items-center gap-4">
          <SkeletonBlock className="h-16 w-16 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-6 w-48" />
            <SkeletonBlock className="h-4 w-64" />
          </div>
        </div>
      </div>
      <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
        <SkeletonBlock className="h-5 w-56" />
        <div className="mt-4 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2 border-b border-zinc-100 pb-4 last:border-0 dark:border-zinc-800">
              <div className="flex justify-between gap-4">
                <SkeletonBlock className="h-4 w-32" />
                <SkeletonBlock className="h-4 w-12" />
              </div>
              <SkeletonBlock className="h-2 w-full rounded-full" />
              <SkeletonBlock className="h-12 w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
          <SkeletonBlock className="h-5 w-24" />
          <div className="mt-3 space-y-2">
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-5/6" />
          </div>
        </div>
        <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
          <SkeletonBlock className="h-5 w-36" />
          <div className="mt-3 space-y-2">
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Job apply flow: initial data load */
export function JobApplyPageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl py-6" aria-busy="true" aria-label="Loading">
      <SkeletonBlock className="h-4 w-32" />
      <SkeletonBlock className="mt-6 h-8 w-2/3 max-w-md" />
      <SkeletonBlock className="mt-2 h-4 w-48" />
      <div className="mt-8 rounded-[10px] border border-[var(--border)] bg-white p-6 dark:border-white/[0.06] dark:bg-zinc-900">
        <SkeletonBlock className="h-5 w-40" />
        <SkeletonBlock className="mt-3 h-4 w-full" />
        <SkeletonBlock className="mt-2 h-4 w-5/6" />
        <SkeletonBlock className="mt-6 h-10 w-48" />
      </div>
    </div>
  );
}

export function CVAnalysisPageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl py-6">
      <SkeletonBlock className="h-8 w-48" />
      <SkeletonBlock className="mt-2 h-4 w-full max-w-md" />
      <div className="mt-8 space-y-4">
        <SkeletonBlock className="h-10 w-full max-w-sm" />
        <SkeletonBlock className="h-40 w-full rounded-[10px]" />
        <SkeletonBlock className="h-11 w-full" />
      </div>
    </div>
  );
}

/** Mock interview “processing” step — orb-sized circle + lines */
export function MockInterviewProcessingSkeleton({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center px-4"
      aria-busy="true"
      aria-label={title}
    >
      <div
        className="skeleton-shimmer rounded-full bg-zinc-200/90 dark:bg-zinc-700/85"
        style={{
          width: "min(200px, 42vmin)",
          height: "min(200px, 42vmin)",
        }}
      />
      <div className="mt-8 w-full max-w-sm space-y-3">
        <SkeletonBlock className="mx-auto h-4 w-[75%]" />
        <SkeletonBlock className="mx-auto h-3 w-1/2" />
      </div>
      <p className="mt-6 text-center text-sm font-medium text-gray-900 dark:text-zinc-200">{title}</p>
      {subtitle && (
        <p className="mt-1 max-w-xs text-center text-xs text-gray-500 dark:text-zinc-500">{subtitle}</p>
      )}
    </div>
  );
}
