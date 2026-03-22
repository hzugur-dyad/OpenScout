"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { cn } from "@/lib/utils";
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

export function CandidateApplicationsFilters({ className }: { className?: string }) {
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
    <div
      className={cn(
        "grid grid-cols-1 gap-6 sm:grid-cols-2 sm:items-end lg:max-w-xl lg:grid-cols-2",
        className
      )}
    >
      <div className="flex flex-col gap-2">
        <label
          htmlFor="applications-status"
          className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#787774] dark:text-zinc-500"
        >
          Status
        </label>
        <CustomSelect
          id="applications-status"
          options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={status}
          onChange={(v) => push({ status: v as CandidateApplicationStatusFilter })}
          aria-label="Filter by status"
          triggerClassName="border-[#EAEAEA] bg-[#FBFBFA] dark:border-zinc-700 dark:bg-zinc-800"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label
          htmlFor="applications-sort"
          className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#787774] dark:text-zinc-500"
        >
          Sort
        </label>
        <CustomSelect
          id="applications-sort"
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={sort}
          onChange={(v) => push({ sort: v as CandidateApplicationSort })}
          aria-label="Sort applications"
          triggerClassName="border-[#EAEAEA] bg-[#FBFBFA] dark:border-zinc-700 dark:bg-zinc-800"
        />
      </div>
    </div>
  );
}
