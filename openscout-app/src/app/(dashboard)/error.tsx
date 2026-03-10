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
    <div className="mx-auto max-w-md rounded-[10px] border border-amber-200 bg-amber-50 p-8 text-center">
      <h2 className="text-lg font-bold text-amber-900">Something went wrong</h2>
      <p className="mt-2 text-sm text-amber-800">
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
