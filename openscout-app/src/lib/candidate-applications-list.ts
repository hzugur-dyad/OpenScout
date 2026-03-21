import {
  computeHiringScore,
  hiringScoreInputsFromInterviewRow,
} from "@/lib/hiring-score";

/** Mirrors `job_applications.application_status` (employer pipeline). */
export type CandidateApplicationPipelineStatus = "applied" | "shortlisted" | "rejected";

export type CandidateApplicationSort = "recent" | "hiring";

export type CandidateApplicationStatusFilter = "all" | CandidateApplicationPipelineStatus;

export type CandidateApplicationRow = {
  id: string;
  job_id: string;
  created_at: string;
  application_status: string;
  cv_score: number | null;
  interview_score: number | null;
  interview_report: unknown;
  job_listings: {
    id: string;
    title: string;
    companies: { name: string } | null;
  } | null;
};

export function applicationHiringScore(row: {
  interview_score: number | null;
  interview_report: unknown;
}): number {
  return computeHiringScore(
    hiringScoreInputsFromInterviewRow({
      interview_score: row.interview_score,
      interview_report: row.interview_report,
    })
  );
}

/** Candidate-facing label; same `application_status` values as employer workflow. */
export function candidatePipelineLabel(applicationStatus: string): string {
  const s = applicationStatus || "applied";
  if (s === "shortlisted") return "Shortlisted";
  if (s === "rejected") return "Rejected";
  return "Applied";
}

export function filterCandidateApplications(
  rows: CandidateApplicationRow[],
  status: CandidateApplicationStatusFilter
): CandidateApplicationRow[] {
  if (status === "all") return rows;
  return rows.filter((r) => (r.application_status || "applied") === status);
}

export function sortCandidateApplications(
  rows: CandidateApplicationRow[],
  sort: CandidateApplicationSort
): CandidateApplicationRow[] {
  const copy = [...rows];
  if (sort === "recent") {
    copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return copy;
  }
  copy.sort((a, b) => applicationHiringScore(b) - applicationHiringScore(a));
  return copy;
}

export function parseCandidateApplicationsQuery(searchParams: Record<string, string | string[] | undefined>): {
  sort: CandidateApplicationSort;
  status: CandidateApplicationStatusFilter;
} {
  const raw = (k: string) => {
    const v = searchParams[k];
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  };
  const sortRaw = raw("sort");
  const sort: CandidateApplicationSort = sortRaw === "hiring" ? "hiring" : "recent";

  const st = raw("status");
  const status: CandidateApplicationStatusFilter =
    st === "applied" || st === "shortlisted" || st === "rejected" || st === "all" ? st : "all";

  return { sort, status };
}
