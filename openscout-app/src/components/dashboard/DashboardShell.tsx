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
} from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/onboarding", label: "Profile", icon: FileText },
  { href: "/cv-analysis", label: "CV Analysis", icon: FileText },
  { href: "/mock-interview", label: "Mock Interview", icon: MessageCircle },
  { href: "/jobs", label: "Job Listings", icon: Briefcase },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const completedSteps = 0; // TODO: derive from user profile/journey
  const totalSteps = 7;

  return (
    <div className="flex min-h-screen bg-gray-50/50">
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
          <Link href="/dashboard" className="flex items-center gap-2">
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
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
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

        {/* Your Journey widget - floating */}
        <div className="fixed bottom-6 right-6 z-20 hidden lg:block">
          <div
            className="flex items-center gap-3 rounded-[10px] border border-[var(--border)] bg-white px-4 py-3 shadow-card"
            style={{ minWidth: 180 }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--primary)" }}
            >
              <Rocket className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium">Your Journey</p>
              <p className="text-xs text-gray-500">
                {completedSteps} / {totalSteps} complete
              </p>
            </div>
          </div>
        </div>

        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
