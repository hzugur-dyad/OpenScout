"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EmployerApplicationStatusBadge } from "@/components/employer/EmployerApplicationStatusBadge";

type Props = {
  applicationId: string;
  currentStatus: string;
};

export function EmployerApplicationStatusActions({ applicationId, currentStatus }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const st = currentStatus || "applied";

  async function patchStatus(status: "shortlisted" | "rejected" | "applied") {
    setPending(true);
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
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500 dark:text-zinc-500">Pipeline</span>
        <EmployerApplicationStatusBadge status={st} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || st === "shortlisted"}
          onClick={() => patchStatus("shortlisted")}
        >
          Shortlist
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || st === "rejected"}
          onClick={() => patchStatus("rejected")}
        >
          Reject
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending || st === "applied"}
          onClick={() => patchStatus("applied")}
        >
          Mark applied
        </Button>
      </div>
    </div>
  );
}
