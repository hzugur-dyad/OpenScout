"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type Props = {
  applicationId: string;
  initialNotes: string | null;
};

export function EmployerApplicationNotesForm({ applicationId, initialNotes }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNotes(initialNotes ?? "");
  }, [initialNotes]);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/employer/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(typeof j.error === "string" ? j.error : "Could not save notes");
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={5}
        className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-gray-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        placeholder="Private notes about this candidate…"
      />
      <Button type="button" variant="secondary" size="sm" onClick={save} isLoading={saving}>
        Save notes
      </Button>
    </div>
  );
}
