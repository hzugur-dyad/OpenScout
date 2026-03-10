"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PENDING_EMPLOYER_KEY = "pending_employer_company";
const PENDING_EMPLOYER_SECTOR = "pending_employer_sector";

export function CompleteEmployerRegistration() {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    let cancelled = false;

    async function run() {
      let pending: string | null = null;
      try {
        pending = sessionStorage.getItem(PENDING_EMPLOYER_KEY);
      } catch {
        return;
      }
      if (!pending?.trim()) return;

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: existing } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing || cancelled) return;

      const name = pending.trim();
      let sector: string | null = null;
      try {
        sector = sessionStorage.getItem(PENDING_EMPLOYER_SECTOR);
      } catch {}
      const { error: insertErr } = await supabase
        .from("companies")
        .insert({
          name,
          user_id: user.id,
          ...(sector ? { sector } : {}),
          trial_started_at: new Date().toISOString(),
        });
      if (insertErr) return;

      await supabase.from("profiles").update({ role: "employer" }).eq("user_id", user.id);
      try {
        sessionStorage.removeItem(PENDING_EMPLOYER_KEY);
        sessionStorage.removeItem(PENDING_EMPLOYER_SECTOR);
      } catch {}
      done.current = true;
      if (!cancelled) router.refresh();
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
