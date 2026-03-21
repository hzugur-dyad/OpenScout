"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmployerApplicationStatusBadge } from "@/components/employer/EmployerApplicationStatusBadge";

const PIPELINE_STATUSES = [
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offer", label: "Offer" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
] as const;

type PipelineStatus = (typeof PIPELINE_STATUSES)[number]["value"];

type Props = {
  applicationId: string;
  currentStatus: string;
};

export function EmployerApplicationStatusActions({ applicationId, currentStatus }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const st = (currentStatus || "applied") as PipelineStatus;

  async function patchStatus(status: PipelineStatus) {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/employer/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(typeof j.error === "string" ? j.error : "Update failed");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500 dark:text-zinc-500">Pipeline</span>
        <EmployerApplicationStatusBadge status={st} />
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <select
        className="w-full max-w-xs rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-gray-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        disabled={pending}
        value={st}
        onChange={(e) => void patchStatus(e.target.value as PipelineStatus)}
        aria-label="Update pipeline status"
      >
        {PIPELINE_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
