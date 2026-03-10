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
    <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft">
      <h2 className="text-lg font-semibold">Create your company</h2>
      <p className="mt-1 text-sm text-gray-500">
        To post job listings, first create a company profile.
      </p>

      <div className="mt-6">
        <label className="text-sm font-medium">Company name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme Inc."
          className="mt-2 w-full rounded-[10px] border border-[var(--border-strong)] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4">
          <Button variant="primary" onClick={handleCreate} isLoading={loading}>
            Create company
          </Button>
        </div>
      </div>
    </div>
  );
}

