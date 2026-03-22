"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { PencilSimple } from "@phosphor-icons/react";

export function EditCompanyName({
  companyId,
  initialName,
}: {
  companyId: string;
  initialName: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setError(null);
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Company name is required");

      const { error: updateError } = await supabase
        .from("companies")
        .update({ name: trimmed })
        .eq("id", companyId)
        .eq("user_id", user.id);
      if (updateError) throw updateError;

      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    } finally {
      setLoading(false);
    }
  }

  if (editing) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-[10px] border border-[var(--border-strong)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          placeholder="Company name"
          autoFocus
        />
        <Button variant="primary" size="sm" onClick={handleSave} isLoading={loading}>
          Save
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setEditing(false); setName(initialName); setError(null); }} disabled={loading}>
          Cancel
        </Button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-medium text-gray-700 dark:text-zinc-200">{initialName}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        aria-label="Edit company name"
      >
        <PencilSimple className="h-4 w-4" weight="regular" aria-hidden />
        Edit
      </button>
    </span>
  );
}
