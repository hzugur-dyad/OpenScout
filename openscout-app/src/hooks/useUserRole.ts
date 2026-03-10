"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/role";

export function useUserRole(): {
  role: UserRole | null;
  loading: boolean;
} {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setRole(null);
          setLoading(false);
        }
        return;
      }

      const [{ data: profile }, { data: company }] = await Promise.all([
        supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle(),
        supabase.from("companies").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
      ]);

      if (cancelled) return;
      let r = profile?.role;
      if (r !== "candidate" && r !== "employer" && company) r = "employer";
      if (r !== "candidate" && r !== "employer") r = "candidate";
      setRole(r);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return { role, loading };
}
