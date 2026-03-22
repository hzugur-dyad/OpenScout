import { candidatePipelineLabel } from "@/lib/candidate-applications-list";

/**
 * Same `application_status` as employer (`applied` | `shortlisted` | `rejected`).
 * Minimalist-ui: pill tags, muted pastels, uppercase + tracking.
 */
export function CandidateApplicationStatusBadge({ applicationStatus }: { applicationStatus: string }) {
  const base =
    "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]";
  const s = applicationStatus || "applied";
  const label = candidatePipelineLabel(s);

  if (s === "shortlisted") {
    return (
      <span
        className={`${base} bg-[#EDF3EC] text-[#346538] dark:bg-[#1a2e1c] dark:text-[#a8c4a9]`}
      >
        {label}
      </span>
    );
  }
  if (s === "rejected") {
    return (
      <span
        className={`${base} bg-[#FDEBEC] text-[#9F2F2D] dark:bg-[#2c1819] dark:text-[#e8a8a6]`}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      className={`${base} bg-[#E1F3FE] text-[#1F6C9F] dark:bg-[#152a38] dark:text-[#8ec5e8]`}
    >
      {label}
    </span>
  );
}
