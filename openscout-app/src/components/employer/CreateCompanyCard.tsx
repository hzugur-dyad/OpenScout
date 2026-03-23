"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function CreateCompanyCard() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setError(null);
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Company name is required");

      const { error: insertError } = await supabase.from("companies").insert({
        name: trimmed,
        user_id: user.id,
      });
      if (insertError) throw insertError;

      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not create company";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="os-surface-card p-6 md:p-8">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Create your company</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        To post job listings, first create a company profile.
      </p>

      <div className="mt-8">
        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Company name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme Inc."
          className="mt-2 w-full rounded-xl border border-[var(--border-strong)] bg-zinc-50/80 px-4 py-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-primary focus:ring-2 focus:ring-primary/25 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="mt-4">
          <Button variant="primary" onClick={handleCreate} isLoading={loading}>
            Create company
          </Button>
        </div>
      </div>
    </div>
  );
}

