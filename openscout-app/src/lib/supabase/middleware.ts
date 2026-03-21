import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getUserRole } from "@/lib/role";

const protectedPaths = ["/onboarding", "/dashboard", "/cv-analysis", "/mock-interview", "/employer", "/pricing"];
const isProtectedPath = (path: string) => {
  if (protectedPaths.some((p) => path === p || path.startsWith(p + "/"))) return true;
  if (path === "/pricing") return true;
  if (/^\/jobs\/[^/]+\/apply/.test(path)) return true;
  return false;
};

const candidateOnlyPaths = ["/onboarding", "/dashboard", "/cv-analysis", "/mock-interview", "/pricing"];
const isCandidateOnlyPath = (path: string) => {
  if (candidateOnlyPaths.some((p) => path === p || path.startsWith(p + "/"))) return true;
  if (/^\/jobs\/[^/]+\/apply/.test(path)) return true;
  return false;
};

const authPaths = ["/login", "/register"];
const employerAuthPaths = ["/employer/login", "/employer/register"];

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isAuth = authPaths.some((p) => path === p || path.startsWith(p + "/"));
  const isEmployerAuth = employerAuthPaths.some((p) => path === p || path.startsWith(p + "/"));
  const isProtected = isProtectedPath(path) && !isEmployerAuth;

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    const fullRedirect = path + (request.nextUrl.search || "");
    redirectUrl.searchParams.set("redirect", fullRedirect);
    return NextResponse.redirect(redirectUrl);
  }

  const emailConfirmed = (user as { email_confirmed_at?: string } | null)?.email_confirmed_at;
  if (isProtected && user && !emailConfirmed) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/confirm-email";
    redirectUrl.searchParams.set("redirect", path + (request.nextUrl.search || ""));
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (isAuth || isEmployerAuth)) {
    let role = await getUserRole(supabase);
    if (!role) {
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (company) role = "employer";
      else role = "candidate";
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = role === "employer" ? "/employer" : "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isProtected) {
    let role = await getUserRole(supabase);
    if (!role) {
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (company) role = "employer";
      else role = "candidate";
    }
    const redirectUrl = request.nextUrl.clone();
    if (role === "candidate" && path.startsWith("/employer")) {
      redirectUrl.pathname = "/dashboard";
      return NextResponse.redirect(redirectUrl);
    }
    if (role === "employer" && isCandidateOnlyPath(path)) {
      redirectUrl.pathname = "/employer";
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Logged-in users visiting public /jobs or /jobs/[id]: candidates get dashboard layout; employers go to employer dashboard
  if (user && (path === "/jobs" || /^\/jobs\/[^/]+$/.test(path))) {
    let role = await getUserRole(supabase);
    if (!role) {
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (company) role = "employer";
      else role = "candidate";
    }
    const redirectUrl = request.nextUrl.clone();
    if (role === "employer") {
      redirectUrl.pathname = "/employer";
      return NextResponse.redirect(redirectUrl);
    }
    redirectUrl.pathname = path === "/jobs" ? "/dashboard/jobs" : `/dashboard${path}`;
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
