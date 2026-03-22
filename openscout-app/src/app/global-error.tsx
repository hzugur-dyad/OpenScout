"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="rounded-[10px] border border-red-200 bg-white p-8 shadow-card max-w-md text-center dark:border-white/[0.06] dark:bg-zinc-900">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Something went wrong</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            An unexpected error occurred. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-[10px] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
