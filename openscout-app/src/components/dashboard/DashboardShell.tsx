"use client";

import {
  Briefcase,
  ChatCircle,
  ClipboardText,
  ClockCounterClockwise,
  CreditCard,
  FileText,
  SquaresFour,
  User,
} from "@phosphor-icons/react";
import { ReferralAttribute } from "./ReferralAttribute";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Sidebar, type NavItem } from "@/components/layout/Sidebar";
import { MobileNavToggleButton } from "@/components/ui/mobile-nav-toggle-button";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";

const candidateNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: SquaresFour },
  { href: "/onboarding", label: "My Profile", icon: FileText },
  { href: "/cv-analysis", label: "CV Analysis", icon: FileText },
  { href: "/mock-interview", label: "Mock Interview", icon: ChatCircle },
  { href: "/dashboard/interviews", label: "Interview History", icon: ClockCounterClockwise },
  { href: "/dashboard/applications", label: "Applications", icon: ClipboardText },
  { href: "/dashboard/jobs", label: "Job Listings", icon: Briefcase },
  { href: "/pricing", label: "Upgrade", icon: CreditCard },
];

const employerNavItems: NavItem[] = [
  { href: "/employer", label: "Dashboard", icon: SquaresFour },
  { href: "/employer/profile", label: "Profile", icon: User },
  { href: "/employer/pricing", label: "Billing", icon: CreditCard },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  /** Desktop: true when sidebar is expanded on hover (for main content margin) */
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const pathname = usePathname();
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

  const [, setCompletedSteps] = useState<number>(0);

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
    <div className="os-product-shell flex min-h-[100dvh] bg-transparent">
      <ReferralAttribute />
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-950/50 lg:hidden"
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

      <div
        className={`relative z-0 flex min-h-[100dvh] flex-1 flex-col transition-[margin] duration-200 ease-in-out ${
          sidebarExpanded ? "lg:ml-[240px]" : "lg:ml-[72px]"
        }`}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-zinc-200/70 bg-white/90 px-3.5 shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur-xl sm:px-4 dark:border-zinc-800/80 dark:bg-zinc-950/85 dark:shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)] lg:h-[4.25rem] lg:px-8">
          <MobileNavToggleButton
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle className="h-11 w-11 rounded-2xl sm:h-9 sm:w-9 sm:rounded-xl" />
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
