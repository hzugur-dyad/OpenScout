export type ApplicationSortKey = "recent" | "overall" | "technical" | "communication";

export type ApplicationStatusFilter = "all" | "applied" | "shortlisted" | "rejected";

export type EmployerApplicationListItem = {
  id: string;
  user_id: string;
  application_status: string;
  cv_score: number | null;
  interview_score: number | null;
  interview_report: unknown;
  created_at: string;
  profiles: { first_name?: string; last_name?: string; email?: string } | null;
};

function reportScores(report: unknown): {
  technical: number | null;
  communication: number | null;
} {
  const r = report as { technical_score?: unknown; communication_score?: unknown } | null;
  const technical = typeof r?.technical_score === "number" ? r.technical_score : null;
  const communication = typeof r?.communication_score === "number" ? r.communication_score : null;
  return { technical, communication };
}

export function filterEmployerApplications(
  rows: EmployerApplicationListItem[],
  status: ApplicationStatusFilter,
  minScore: number | null
): EmployerApplicationListItem[] {
  let out = rows;
  if (status !== "all") {
    out = out.filter((r) => r.application_status === status);
  }
  if (minScore !== null && !Number.isNaN(minScore)) {
    out = out.filter((r) => typeof r.interview_score === "number" && r.interview_score >= minScore);
  }
  return out;
}

export function sortEmployerApplications(
  rows: EmployerApplicationListItem[],
  sort: ApplicationSortKey
): EmployerApplicationListItem[] {
  const copy = [...rows];
  if (sort === "recent") {
    copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return copy;
  }
  if (sort === "overall") {
    copy.sort((a, b) => (b.interview_score ?? -1) - (a.interview_score ?? -1));
    return copy;
  }
  if (sort === "technical") {
    copy.sort(
      (a, b) =>
        (reportScores(b.interview_report).technical ?? -1) - (reportScores(a.interview_report).technical ?? -1)
    );
    return copy;
  }
  if (sort === "communication") {
    copy.sort(
      (a, b) =>
        (reportScores(b.interview_report).communication ?? -1) -
        (reportScores(a.interview_report).communication ?? -1)
    );
    return copy;
  }
  return copy;
}

export function parseApplicationsListQuery(searchParams: Record<string, string | string[] | undefined>): {
  sort: ApplicationSortKey;
  status: ApplicationStatusFilter;
  minScore: number | null;
} {
  const raw = (k: string) => {
    const v = searchParams[k];
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  };
  const sortRaw = raw("sort");
  const sort: ApplicationSortKey =
    sortRaw === "overall" || sortRaw === "technical" || sortRaw === "communication" || sortRaw === "recent"
      ? sortRaw
      : "recent";

  const st = raw("status");
  const status: ApplicationStatusFilter =
    st === "applied" || st === "shortlisted" || st === "rejected" || st === "all" ? st : "all";

  const minRaw = raw("minScore");
  let minScore: number | null = null;
  if (minRaw !== undefined && minRaw !== "") {
    const n = Number(minRaw);
    if (!Number.isNaN(n)) minScore = Math.min(100, Math.max(0, n));
  }

  return { sort, status, minScore };
}

export function parseCompareApplicationIds(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
}
