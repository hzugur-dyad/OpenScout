"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  LayoutDashboard,
  FileText,
  MessageCircle,
  Briefcase,
  Menu,
  X,
  Rocket,
  LogOut,
  CreditCard,
  User,
} from "lucide-react";
import { ReferralAttribute } from "./ReferralAttribute";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";

const candidateNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/onboarding", label: "Profile", icon: FileText },
  { href: "/cv-analysis", label: "CV Analysis", icon: FileText },
  { href: "/mock-interview", label: "Mock Interview", icon: MessageCircle },
  { href: "/dashboard/jobs", label: "Job Listings", icon: Briefcase },
  { href: "/pricing", label: "Upgrade Plan", icon: CreditCard },
];

const employerNavItems = [
  { href: "/employer", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employer/profile", label: "Profile", icon: User },
  { href: "/employer/pricing", label: "Billing", icon: CreditCard },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { role, loading } = useUserRole();
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
    <div className="flex min-h-screen bg-gray-50/50">
      <ReferralAttribute />
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-[var(--border)] bg-white transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-[var(--border)] px-4 lg:justify-center">
          <Link href={dashboardHref} className="flex items-center gap-2">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--primary)" }}
            >
              <Compass className="h-5 w-5 text-white" />
            </span>
            <span className="font-semibold">OpenScout</span>
          </Link>
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <nav className="space-y-1 p-4">
          {navItems.map((item, index) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={`${item.label}-${item.href}-${index}`}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary-lighter text-primary-dark"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                style={isActive ? { backgroundColor: "var(--primary-muted)" } : {}}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-[var(--border)] p-4">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:pl-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[var(--border)] bg-white px-4 lg:px-8">
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
        </header>

        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
