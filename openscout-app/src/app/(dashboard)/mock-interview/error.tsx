"use client";

import { useEffect } from "react";
import Link from "next/link";
import { captureException } from "@/lib/monitoring";

export default function MockInterviewError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { route: "/mock-interview" });
  }, [error]);

  return (
    <main className="mx-auto max-w-md px-4 py-10 text-center">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Something went wrong</h1>
      <p className="mt-2 text-base leading-relaxed text-gray-600 dark:text-zinc-400" role="status">
        You can try again or return to the dashboard.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex min-h-11 w-full max-w-xs touch-manipulation items-center justify-center rounded-lg bg-[var(--primary)] px-5 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 sm:w-auto"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 w-full max-w-xs touch-manipulation items-center justify-center rounded-lg border border-gray-200 px-5 text-sm font-medium text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:border-zinc-700 dark:text-zinc-200 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-950 sm:w-auto"
        >
          Dashboard
        </Link>
      </div>
    </main>
  );
}
