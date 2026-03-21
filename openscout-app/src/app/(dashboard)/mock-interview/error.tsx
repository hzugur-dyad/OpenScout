"use client";

import { useEffect } from "react";
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
    <div className="mx-auto max-w-md px-4 py-10 text-center">
      <p className="text-sm text-gray-600 dark:text-zinc-400">Something went wrong. You can try again.</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 text-sm font-medium text-[var(--primary)] underline"
      >
        Try again
      </button>
    </div>
  );
}
