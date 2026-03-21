import { candidatePipelineLabel } from "@/lib/candidate-applications-list";

/**
 * Same `application_status` as employer (`applied` | `shortlisted` | `rejected`).
 * For `applied`, we use the same "Applied" label as the employer UI; candidates can still be "in review" while in this state.
 */
export function CandidateApplicationStatusBadge({ applicationStatus }: { applicationStatus: string }) {
  const base = "inline-flex rounded px-2 py-0.5 text-xs font-medium";
  const s = applicationStatus || "applied";
  const label = candidatePipelineLabel(s);

  if (s === "shortlisted") {
    return (
      <span className={`${base} bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200`}>{label}</span>
    );
  }
  if (s === "rejected") {
    return <span className={`${base} bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200`}>{label}</span>;
  }
  return <span className={`${base} bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300`}>{label}</span>;
}
