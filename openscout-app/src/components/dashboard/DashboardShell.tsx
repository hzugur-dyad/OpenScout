"use client";

import { List } from "@phosphor-icons/react";
import {
  LayoutDashboard,
  FileText,
  MessageCircle,
  Briefcase,
  CreditCard,
  User,
  History,
  ClipboardList,
} from "lucide-react";
import { ReferralAttribute } from "./ReferralAttribute";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Sidebar, type NavItem } from "@/components/layout/Sidebar";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";

const candidateNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/onboarding", label: "My profile", icon: FileText },
  { href: "/cv-analysis", label: "CV Analysis", icon: FileText },
  { href: "/mock-interview", label: "Mock Interview", icon: MessageCircle },
  { href: "/dashboard/interviews", label: "Interview History", icon: History },
  { href: "/dashboard/applications", label: "Applications", icon: ClipboardList },
  { href: "/dashboard/jobs", label: "Job Listings", icon: Briefcase },
  { href: "/pricing", label: "Upgrade Plan", icon: CreditCard },
];

const employerNavItems: NavItem[] = [
  { href: "/employer", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employer/profile", label: "Profile", icon: User },
  { href: "/employer/pricing", label: "Billing", icon: CreditCard },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  /** Desktop: true when sidebar is expanded on hover (for main content margin) */
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const pathname = usePathname();
  const isCandidateDashboardHome = pathname === "/dashboard";
  const { role } = useUserRole();
  const isEmployerPath = pathname.startsWith("/employer");
  const effectiveRole = role ?? (isEmployerPath ? "employer" : "candidate");
  const navItems = effectiveRole === "employer" ? employerNavItems : candidateNavItems;
  const dashboardHref = effectiveRole === "employer" ? "/employer" : "/dashboard";

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const totalSteps = 7;
  const [completedSteps, setCompletedSteps] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function loadJourney() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
        profileRes,
        workRes,
        eduRes,
        prefRes,
        linksRes,
        cvRes,
        interviewRes,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("first_name,last_name,location,professional_summary")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("work_experiences")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("educations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("job_preferences")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("professional_links")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("cv_analyses")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("mock_interviews")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);

      const profile = profileRes.data;
      const hasBasics = Boolean(
        profile?.first_name &&
          profile?.last_name &&
          profile?.location &&
          profile?.professional_summary
      );

      const steps = [
        hasBasics,
        (workRes.count ?? 0) > 0,
        (eduRes.count ?? 0) > 0,
        Boolean(prefRes.data),
        Boolean(linksRes.data),
        (cvRes.count ?? 0) > 0,
        (interviewRes.count ?? 0) > 0,
      ];

      const completed = steps.filter(Boolean).length;
      if (!cancelled) setCompletedSteps(completed);
    }

    loadJourney();
    return () => {
      cancelled = true;
    };
  }, [supabase, role]);

  return (
    <div
      className={`relative flex min-h-[100dvh] dark:bg-zinc-950 ${
        isCandidateDashboardHome ? "bg-[#F7F6F3]" : "bg-zinc-50"
      }`}
    >
      {isCandidateDashboardHome ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.06]"
          style={{
            background:
              "radial-gradient(ellipse 100% 70% at 50% -25%, rgb(139 115 85), transparent)",
          }}
          aria-hidden
        />
      ) : null}
      <ReferralAttribute />
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        navItems={navItems}
        dashboardHref={dashboardHref}
        onSignOut={handleSignOut}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
        onExpandedChange={setSidebarExpanded}
      />

      {/* Main content - offset by sidebar width on desktop (hover expands/collapses) */}
      <div
        className={`relative z-10 flex min-h-[100dvh] flex-1 flex-col transition-[margin] duration-200 ease-in-out ${
          sidebarExpanded ? "lg:ml-[240px]" : "lg:ml-[72px]"
        }`}
      >
        {/* Top bar */}
        <header
          className={`sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b px-4 backdrop-blur-sm lg:px-8 dark:border-zinc-800 dark:bg-zinc-950/90 ${
            isCandidateDashboardHome
              ? "border-[#EAEAEA] bg-[#F7F6F3]/95"
              : "border-zinc-200/80 bg-zinc-50/95 dark:bg-zinc-950/95"
          }`}
        >
          <button
            type="button"
            className="rounded-md p-1.5 text-[#111111] transition-colors hover:bg-black/[0.04] lg:hidden dark:text-zinc-100 dark:hover:bg-white/[0.06]"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <List className="h-6 w-6" weight="bold" aria-hidden />
          </button>
          <div className="ml-auto flex items-center">
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
