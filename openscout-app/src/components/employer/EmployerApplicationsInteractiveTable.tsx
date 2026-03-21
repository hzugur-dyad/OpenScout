"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EmployerApplicationStatusBadge } from "@/components/employer/EmployerApplicationStatusBadge";
import { HiringFitBadge } from "@/components/employer/HiringFitBadge";
import type { EmployerApplicationListItem } from "@/lib/employer-applications-list";
import {
  computeHiringScore,
  hiringFitTagFromScore,
  hiringScoreInputsFromInterviewRow,
} from "@/lib/hiring-score";

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
  jobId: string;
  applications: EmployerApplicationListItem[];
};

function downloadApplicationsCsv(jobId: string, applications: EmployerApplicationListItem[]) {
  const headers = [
    "ApplicationId",
    "Name",
    "Email",
    "Status",
    "CVScore",
    "InterviewScore",
    "HiringScore",
    "Recommendation",
    "CreatedAt",
  ];
  const lines = [headers.join(",")];
  for (const a of applications) {
    const profile = a.profiles;
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "";
    const email = profile?.email ?? "";
    const hiringScore = computeHiringScore(hiringScoreInputsFromInterviewRow(a));
    const rec = (a.ai_recommendation_reason ?? "").replaceAll('"', '""');
    lines.push(
      [
        a.id,
        `"${name.replaceAll('"', '""')}"`,
        `"${email.replaceAll('"', '""')}"`,
        a.application_status || "applied",
        a.cv_score ?? "",
        a.interview_score ?? "",
        hiringScore,
        `"${rec}"`,
        a.created_at ? new Date(a.created_at).toISOString() : "",
      ].join(",")
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url;
  el.download = `applications-${jobId}.csv`;
  el.click();
  URL.revokeObjectURL(url);
}

export function EmployerApplicationsInteractiveTable({ jobId, applications }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<PipelineStatus>("shortlisted");

  function toggleId(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }

  async function patchStatus(applicationId: string, status: PipelineStatus) {
    setActionError(null);
    setPendingId(applicationId);
    try {
      const res = await fetch(`/api/employer/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setActionError(typeof j.error === "string" ? j.error : "Update failed");
        return;
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function applyBulkStatus() {
    if (selected.length === 0) return;
    setActionError(null);
    setBulkPending(true);
    try {
      const res = await fetch("/api/employer/applications/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, applicationIds: selected, status: bulkStatus }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setActionError(typeof j.error === "string" ? j.error : "Bulk update failed");
        return;
      }
      setSelected([]);
      router.refresh();
    } finally {
      setBulkPending(false);
    }
  }

  const compareHref =
    selected.length >= 2 && selected.length <= 3
      ? `/employer/compare?ids=${selected.map(encodeURIComponent).join(",")}`
      : null;

  return (
    <div>
      {actionError && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {actionError}
        </p>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => downloadApplicationsCsv(jobId, applications)}>
          Export CSV
        </Button>
        <span className="text-sm text-gray-500 dark:text-zinc-500">
          Select candidates to compare (2–3) or bulk-update status.
        </span>
        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-gray-50 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800/80">
            <span className="text-xs text-gray-600 dark:text-zinc-400">{selected.length} selected</span>
            <select
              className="rounded border border-[var(--border)] bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as PipelineStatus)}
              aria-label="Bulk status"
            >
              {PIPELINE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={bulkPending}
              onClick={() => void applyBulkStatus()}
            >
              Apply status
            </Button>
          </div>
        )}
        {compareHref ? (
          <Link href={compareHref}>
            <Button variant="secondary" size="sm">
              Compare selected
            </Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Compare selected (2–3)
          </Button>
        )}
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-[var(--border)] bg-white shadow-soft dark:border-zinc-700 dark:bg-zinc-900">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800">
            <tr>
              <th className="w-10 px-2 py-3" aria-label="Select row" />
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Candidate</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Status</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">CV</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Interview</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Hiring score</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Fit</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Created</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Pipeline</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((a) => {
              const profile = a.profiles;
              const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || null;
              const candidateLabel = name || (
                <span className="font-mono text-xs text-gray-500 dark:text-zinc-500">{a.user_id}</span>
              );
              const st = (a.application_status || "applied") as PipelineStatus;
              const busy = pendingId === a.id;
              const hiringScore = computeHiringScore(hiringScoreInputsFromInterviewRow(a));
              const fitTag = hiringFitTagFromScore(hiringScore);
              return (
                <tr key={a.id} className="border-b border-[var(--border)] last:border-b-0 dark:border-zinc-700">
                  <td className="px-2 py-3 align-middle">
                    <input
                      type="checkbox"
                      checked={selected.includes(a.id)}
                      onChange={() => toggleId(a.id)}
                      className="h-4 w-4 rounded border-gray-300 dark:border-zinc-600"
                      aria-label="Select row"
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-zinc-200">
                    <Link href={`/employer/${jobId}/applications/${a.id}`} className="block hover:underline">
                      <div className="font-medium">{candidateLabel}</div>
                      {name && profile?.email && (
                        <div className="text-xs text-gray-500 dark:text-zinc-500">{profile.email}</div>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <EmployerApplicationStatusBadge status={st} />
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-zinc-200">{a.cv_score ?? "-"}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-zinc-200">{a.interview_score ?? "-"}</td>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-zinc-200">{hiringScore}</td>
                  <td className="px-4 py-3 align-middle">
                    <HiringFitBadge tag={fitTag} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-zinc-500">
                    {a.created_at ? new Date(a.created_at).toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="max-w-[140px] rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-xs text-gray-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                      disabled={busy}
                      value={st}
                      onChange={(e) => patchStatus(a.id, e.target.value as PipelineStatus)}
                      aria-label="Update pipeline status"
                    >
                      {PIPELINE_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
