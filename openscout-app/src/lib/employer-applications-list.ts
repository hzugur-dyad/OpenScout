import {
  computeHiringScore,
  hiringScoreInputsFromInterviewRow,
} from "@/lib/hiring-score";
import {
  computeEmployerDecisionRiskFlags,
  employerConfidenceSortKey,
  employerConsistencySortKey,
  employerProblemSolvingSortKey,
} from "@/lib/employer-intelligence";

export type ApplicationSortKey =
  | "recent"
  | "overall"
  | "technical"
  | "communication"
  | "problem_solving"
  | "best_fit"
  | "low_risk"
  | "confidence"
  | "consistency";

export type ApplicationRiskFilter = "any" | "low";

export type EmployerApplicationsListContext = {
  minCvScore: number | null;
};

export type ApplicationStatusFilter =
  | "all"
  | "applied"
  | "screening"
  | "shortlisted"
  | "interviewing"
  | "offer"
  | "hired"
  | "rejected";

export type EmployerApplicationListItem = {
  id: string;
  user_id: string;
  application_status: string;
  cv_score: number | null;
  interview_score: number | null;
  interview_report: unknown;
  ai_recommendation_reason?: string | null;
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
  minScore: number | null,
  risk: ApplicationRiskFilter,
  ctx: EmployerApplicationsListContext
): EmployerApplicationListItem[] {
  let out = rows;
  if (status !== "all") {
    out = out.filter((r) => r.application_status === status);
  }
  if (minScore !== null && !Number.isNaN(minScore)) {
    out = out.filter((r) => typeof r.interview_score === "number" && r.interview_score >= minScore);
  }
  if (risk === "low") {
    out = out.filter(
      (r) =>
        computeEmployerDecisionRiskFlags(r, { minCvScore: ctx.minCvScore, durationMs: null }).length === 0
    );
  }
  return out;
}

export function sortEmployerApplications(
  rows: EmployerApplicationListItem[],
  sort: ApplicationSortKey,
  ctx: EmployerApplicationsListContext
): EmployerApplicationListItem[] {
  const copy = [...rows];
  const listCtx = { minCvScore: ctx.minCvScore, durationMs: null as number | null };

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
  if (sort === "problem_solving") {
    copy.sort((a, b) => {
      const pb = employerProblemSolvingSortKey(b);
      const pa = employerProblemSolvingSortKey(a);
      if (pb !== null && pa !== null) return pb - pa;
      if (pb !== null) return 1;
      if (pa !== null) return -1;
      return (b.interview_score ?? -1) - (a.interview_score ?? -1);
    });
    return copy;
  }
  if (sort === "best_fit") {
    const hs = (r: EmployerApplicationListItem) =>
      computeHiringScore(hiringScoreInputsFromInterviewRow(r));
    copy.sort((a, b) => hs(b) - hs(a));
    return copy;
  }
  if (sort === "low_risk") {
    const riskN = (r: EmployerApplicationListItem) =>
      computeEmployerDecisionRiskFlags(r, listCtx).length;
    const hs = (r: EmployerApplicationListItem) => computeHiringScore(hiringScoreInputsFromInterviewRow(r));
    copy.sort((a, b) => {
      const dr = riskN(a) - riskN(b);
      if (dr !== 0) return dr;
      return hs(b) - hs(a);
    });
    return copy;
  }
  if (sort === "confidence") {
    copy.sort((a, b) => {
      const db = employerConfidenceSortKey(b, listCtx);
      const da = employerConfidenceSortKey(a, listCtx);
      if (db !== da) return db - da;
      return (b.interview_score ?? -1) - (a.interview_score ?? -1);
    });
    return copy;
  }
  if (sort === "consistency") {
    copy.sort((a, b) => {
      const db = employerConsistencySortKey(b);
      const da = employerConsistencySortKey(a);
      if (db !== da) return db - da;
      return computeHiringScore(hiringScoreInputsFromInterviewRow(b)) -
        computeHiringScore(hiringScoreInputsFromInterviewRow(a));
    });
    return copy;
  }
  return copy;
}

export function parseApplicationsListQuery(searchParams: Record<string, string | string[] | undefined>): {
  sort: ApplicationSortKey;
  status: ApplicationStatusFilter;
  minScore: number | null;
  risk: ApplicationRiskFilter;
} {
  const raw = (k: string) => {
    const v = searchParams[k];
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  };
  const sortRaw = raw("sort");
  const sort: ApplicationSortKey =
    sortRaw === "overall" ||
    sortRaw === "technical" ||
    sortRaw === "communication" ||
    sortRaw === "problem_solving" ||
    sortRaw === "recent" ||
    sortRaw === "best_fit" ||
    sortRaw === "low_risk" ||
    sortRaw === "confidence" ||
    sortRaw === "consistency"
      ? sortRaw
      : "recent";

  const st = raw("status");
  const status: ApplicationStatusFilter =
    st === "applied" ||
    st === "screening" ||
    st === "shortlisted" ||
    st === "interviewing" ||
    st === "offer" ||
    st === "hired" ||
    st === "rejected" ||
    st === "all"
      ? st
      : "all";

  const minRaw = raw("minScore");
  let minScore: number | null = null;
  if (minRaw !== undefined && minRaw !== "") {
    const n = Number(minRaw);
    if (!Number.isNaN(n)) minScore = Math.min(100, Math.max(0, n));
  }

  const riskRaw = raw("risk");
  const risk: ApplicationRiskFilter = riskRaw === "low" ? "low" : "any";

  return { sort, status, minScore, risk };
}

export function parseCompareApplicationIds(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
}
