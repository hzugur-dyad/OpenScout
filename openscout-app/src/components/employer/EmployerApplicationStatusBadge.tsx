export function EmployerApplicationStatusBadge({ status }: { status: string }) {
  const base = "inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize";
  if (status === "shortlisted") {
    return <span className={`${base} bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200`}>Shortlisted</span>;
  }
  if (status === "rejected") {
    return <span className={`${base} bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200`}>Rejected</span>;
  }
  return <span className={`${base} bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300`}>Applied</span>;
}
