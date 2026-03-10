import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextParam = requestUrl.searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      let redirectPath = nextParam ?? "/dashboard";
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
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
        else if (!nextParam) redirectPath = "/dashboard";
      }
      return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback", requestUrl.origin));
}
