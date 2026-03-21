"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EmployerApplicationStatusBadge } from "@/components/employer/EmployerApplicationStatusBadge";
import type { EmployerApplicationListItem } from "@/lib/employer-applications-list";

type Props = {
  jobId: string;
  applications: EmployerApplicationListItem[];
};

export function EmployerApplicationsInteractiveTable({ jobId, applications }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function toggleId(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  async function patchStatus(applicationId: string, status: "shortlisted" | "rejected") {
    setPendingId(applicationId);
    try {
      const res = await fetch(`/api/employer/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(typeof j.error === "string" ? j.error : "Update failed");
        return;
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  const compareHref =
    selected.length >= 2 && selected.length <= 3
      ? `/employer/compare?ids=${selected.map(encodeURIComponent).join(",")}`
      : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500 dark:text-zinc-500">
          Select 2–3 candidates to compare ({selected.length}/3)
        </span>
        {compareHref ? (
          <Link href={compareHref}>
            <Button variant="secondary" size="sm">
              Compare selected
            </Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Compare selected
          </Button>
        )}
      </div>
      <div className="overflow-hidden rounded-[10px] border border-[var(--border)] bg-white shadow-soft dark:border-zinc-700 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800">
            <tr>
              <th className="w-10 px-2 py-3" aria-label="Select for compare" />
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Candidate</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Status</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">CV</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Interview</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Created</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((a) => {
              const profile = a.profiles;
              const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || null;
              const candidateLabel = name || (
                <span className="font-mono text-xs text-gray-500 dark:text-zinc-500">{a.user_id}</span>
              );
              const st = a.application_status || "applied";
              const busy = pendingId === a.id;
              return (
                <tr key={a.id} className="border-b border-[var(--border)] last:border-b-0 dark:border-zinc-700">
                  <td className="px-2 py-3 align-middle">
                    <input
                      type="checkbox"
                      checked={selected.includes(a.id)}
                      onChange={() => toggleId(a.id)}
                      className="h-4 w-4 rounded border-gray-300 dark:border-zinc-600"
                      aria-label="Select for compare"
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
                  <td className="px-4 py-3 text-gray-500 dark:text-zinc-500">
                    {a.created_at ? new Date(a.created_at).toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy || st === "shortlisted"}
                        onClick={() => patchStatus(a.id, "shortlisted")}
                      >
                        Shortlist
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy || st === "rejected"}
                        onClick={() => patchStatus(a.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
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
