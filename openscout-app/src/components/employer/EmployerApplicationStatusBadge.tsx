export function EmployerApplicationStatusBadge({ status }: { status: string }) {
  const base = "inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize";
  if (status === "shortlisted") {
    return (
      <span className={`${base} bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200`}>
        Shortlisted
      </span>
    );
  }
  if (status === "screening") {
    return (
      <span className={`${base} bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200`}>Screening</span>
    );
  }
  if (status === "interviewing") {
    return (
      <span className={`${base} bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200`}>
        Interviewing
      </span>
    );
  }
  if (status === "offer") {
    return (
      <span className={`${base} bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200`}>
        Offer
      </span>
    );
  }
  if (status === "hired") {
    return (
      <span className={`${base} bg-green-100 text-green-900 dark:bg-green-950/50 dark:text-green-200`}>Hired</span>
    );
  }
  if (status === "rejected") {
    return (
      <span className={`${base} bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200`}>Rejected</span>
    );
  }
  return (
    <span className={`${base} bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300`}>Applied</span>
  );
}
