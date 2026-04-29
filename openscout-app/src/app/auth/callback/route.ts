import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { captureServer } from "@/lib/analytics-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics";

function safeInternalRedirectPath(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || value.includes("://")) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextParam = requestUrl.searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      let redirectPath = safeInternalRedirectPath(nextParam) ?? "/dashboard";
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await captureServer(user.id, ANALYTICS_EVENTS.email_confirmed, {});
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        const { data: company } = await supabase
          .from("companies")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        const isEmployer = profile?.role === "employer" || company != null;
        if (isEmployer) redirectPath = "/employer";
        else if (!nextParam) {
          const { data: ob } = await supabase
            .from("profiles")
            .select("onboarding_completed_at")
            .eq("user_id", user.id)
            .maybeSingle();
          redirectPath = (ob as { onboarding_completed_at?: string | null } | null)?.onboarding_completed_at
            ? "/dashboard"
            : "/onboarding";
        }
      }
      return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback", requestUrl.origin));
}
