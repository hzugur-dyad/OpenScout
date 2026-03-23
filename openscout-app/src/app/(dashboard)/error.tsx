"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="os-surface-card mx-auto max-w-md border-amber-200/90 bg-amber-50/95 p-10 text-center ring-1 ring-amber-900/[0.06] dark:border-amber-900/40 dark:bg-amber-950/35 dark:ring-amber-500/10">
      <h2 className="text-lg font-semibold tracking-tight text-amber-950 dark:text-amber-100">Something went wrong</h2>
      <p className="mt-3 text-sm leading-relaxed text-amber-900/90 dark:text-amber-200/90">
        An error occurred loading this page. You can try again or return to the dashboard.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        <Link href="/dashboard">
          <Button variant="outline">Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
