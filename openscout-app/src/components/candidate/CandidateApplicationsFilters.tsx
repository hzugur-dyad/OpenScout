"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CustomSelect } from "@/components/ui/CustomSelect";
import type { CandidateApplicationSort, CandidateApplicationStatusFilter } from "@/lib/candidate-applications-list";

const STATUS_OPTIONS: { value: CandidateApplicationStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "applied", label: "Applied (in review)" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "rejected", label: "Rejected" },
];

const SORT_OPTIONS: { value: CandidateApplicationSort; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "hiring", label: "Highest hiring score" },
];

export function CandidateApplicationsFilters() {
  const router = useRouter();
  const sp = useSearchParams();

  const status = (sp.get("status") as CandidateApplicationStatusFilter) || "all";
  const sort = (sp.get("sort") as CandidateApplicationSort) || "recent";

  function push(next: { status?: CandidateApplicationStatusFilter; sort?: CandidateApplicationSort }) {
    const params = new URLSearchParams(sp.toString());
    const nextStatus = next.status ?? status;
    const nextSort = next.sort ?? sort;
    if (nextStatus === "all") params.delete("status");
    else params.set("status", nextStatus);
    if (nextSort === "recent") params.delete("sort");
    else params.set("sort", nextSort);
    const q = params.toString();
    router.push(q ? `/dashboard/applications?${q}` : "/dashboard/applications");
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-[200px]">
        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-400">Status</label>
        <CustomSelect
          options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={status}
          onChange={(v) => push({ status: v as CandidateApplicationStatusFilter })}
          aria-label="Filter by status"
        />
      </div>
      <div className="min-w-[200px]">
        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-400">Sort</label>
        <CustomSelect
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={sort}
          onChange={(v) => push({ sort: v as CandidateApplicationSort })}
          aria-label="Sort applications"
        />
      </div>
    </div>
  );
}
