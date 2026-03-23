"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type {
  ApplicationRiskFilter,
  ApplicationSortKey,
  ApplicationStatusFilter,
} from "@/lib/employer-applications-list";

export function EmployerApplicationsControls() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function pushQuery(updates: Record<string, string | undefined>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === "") p.delete(k);
      else p.set(k, v);
    }
    const q = p.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  const sort = (sp.get("sort") as ApplicationSortKey) || "recent";
  const status = (sp.get("status") as ApplicationStatusFilter) || "all";
  const minScore = sp.get("minScore") ?? "";
  const risk = (sp.get("risk") as ApplicationRiskFilter) || "any";

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <label className="text-sm text-gray-600 dark:text-zinc-400">
        <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-500">Sort</span>
        <select
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          value={
            sort === "overall" ||
            sort === "technical" ||
            sort === "communication" ||
            sort === "problem_solving" ||
            sort === "recent" ||
            sort === "best_fit" ||
            sort === "low_risk" ||
            sort === "confidence" ||
            sort === "consistency"
              ? sort
              : "recent"
          }
          onChange={(e) => pushQuery({ sort: e.target.value })}
        >
          <option value="recent">Most recent</option>
          <option value="best_fit">Best fit (hiring score)</option>
          <option value="low_risk">Lowest risk first</option>
          <option value="confidence">Highest confidence signal</option>
          <option value="consistency">Strongest consistency</option>
          <option value="overall">Highest interview score</option>
          <option value="technical">Highest technical</option>
          <option value="communication">Highest communication</option>
          <option value="problem_solving">Highest problem solving</option>
        </select>
      </label>
      <label className="text-sm text-gray-600 dark:text-zinc-400">
        <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-500">Risk flags</span>
        <select
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          value={risk === "low" ? "low" : "any"}
          onChange={(e) => pushQuery({ risk: e.target.value === "any" ? undefined : e.target.value })}
        >
          <option value="any">Any</option>
          <option value="low">No automated flags only</option>
        </select>
      </label>
      <label className="text-sm text-gray-600 dark:text-zinc-400">
        <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-500">Status</span>
        <select
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          value={
            status === "all" ||
            status === "applied" ||
            status === "screening" ||
            status === "shortlisted" ||
            status === "interviewing" ||
            status === "offer" ||
            status === "hired" ||
            status === "rejected"
              ? status
              : "all"
          }
          onChange={(e) => pushQuery({ status: e.target.value === "all" ? undefined : e.target.value })}
        >
          <option value="all">All</option>
          <option value="applied">Applied</option>
          <option value="screening">Screening</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="interviewing">Interviewing</option>
          <option value="offer">Offer</option>
          <option value="hired">Hired</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>
      <label className="text-sm text-gray-600 dark:text-zinc-400">
        <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-500">Min interview score</span>
        <input
          type="number"
          min={0}
          max={100}
          placeholder="Any"
          className="w-28 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          value={minScore}
          onChange={(e) => {
            const v = e.target.value.trim();
            pushQuery({ minScore: v === "" ? undefined : v });
          }}
        />
      </label>
    </div>
  );
}
