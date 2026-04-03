"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Icon } from "@phosphor-icons/react";
import { SignOut } from "@phosphor-icons/react";
import { OpenScoutLogoMark } from "@/components/brand/OpenScoutLogoMark";
import { ApplicationsSidebarIcon } from "@/components/icons/ApplicationsSidebarIcon";
import { DashboardSidebarIcon } from "@/components/icons/DashboardSidebarIcon";
import { MockInterviewSidebarIcon } from "@/components/icons/MockInterviewSidebarIcon";
import { ProfileSidebarIcon } from "@/components/icons/ProfileSidebarIcon";
import { Tooltip } from "@/components/ui/Tooltip";
import { MobileNavToggleButton } from "@/components/ui/mobile-nav-toggle-button";

export type NavItem = { href: string; label: string; icon: Icon };

const NAV_ICON_CLASS = "h-5 w-5 shrink-0";

/** Match `notlar/*.svg` - candidate + employer profile, dashboard, applications, mock interview */
const PROFILE_NAV_HREFS = new Set(["/onboarding", "/employer/profile"]);
const DASHBOARD_NAV_HREFS = new Set(["/dashboard", "/employer"]);
const APPLICATIONS_NAV_HREFS = new Set(["/dashboard/applications"]);
const MOCK_INTERVIEW_NAV_HREFS = new Set(["/mock-interview"]);

type SidebarProps = {
  navItems: NavItem[];
  dashboardHref: string;
  onSignOut: () => void;
  /** Mobile: sidebar overlay open state */
  mobileOpen: boolean;
  onMobileClose: () => void;
  /** Called when desktop sidebar expands/collapses (for main content margin) */
  onExpandedChange?: (expanded: boolean) => void;
};

const DESKTOP_BREAKPOINT = 1024;

export function Sidebar({
  navItems,
  dashboardHref,
  onSignOut,
  mobileOpen,
  onMobileClose,
  onExpandedChange,
}: SidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [labelsVisible, setLabelsVisible] = useState(false);

  const isDesktop = () => typeof window !== "undefined" && window.innerWidth >= DESKTOP_BREAKPOINT;

  const handleEnter = useCallback(() => {
    if (!isDesktop()) return;
    setExpanded(true);
    onExpandedChange?.(true);
  }, [onExpandedChange]);

  const handleLeave = useCallback(() => {
    setExpanded(false);
    onExpandedChange?.(false);
  }, [onExpandedChange]);

  useEffect(() => {
    if (expanded || mobileOpen) {
      const t = setTimeout(() => setLabelsVisible(true), 50);
      return () => clearTimeout(t);
    }
    setLabelsVisible(false);
  }, [expanded, mobileOpen]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < DESKTOP_BREAKPOINT && expanded) {
        setExpanded(false);
        onExpandedChange?.(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [expanded, onExpandedChange]);

  /** Collapsed = icon-only. On mobile with drawer open we always show full layout. */
  const collapsed = !expanded && !mobileOpen;

  /** Longest matching href wins so `/dashboard` does not stay active on `/dashboard/applications`, etc. */
  const activeNavHref = (() => {
    let best: string | null = null;
    let bestLen = -1;
    for (const { href } of navItems) {
      if (pathname === href || pathname.startsWith(`${href}/`)) {
        if (href.length > bestLen) {
          bestLen = href.length;
          best = href;
        }
      }
    }
    return best;
  })();

  return (
    <aside
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={`
        fixed left-0 top-0 z-50 flex h-[100dvh] shrink-0 flex-col overflow-x-hidden
        border-r border-[var(--border)] bg-white
        transition-[transform,width] duration-200 ease-in-out
        dark:border-zinc-800 dark:bg-zinc-950
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0
        ${collapsed ? "lg:w-[72px]" : "lg:w-[240px]"}
        w-[240px]
      `}
    >
      <div
        className={`
          flex h-[4.5rem] shrink-0 items-center justify-between gap-3
          ${collapsed ? "lg:justify-center lg:px-0" : "px-4"}
        `}
      >
        <Link
          href={dashboardHref}
          className={`flex min-w-0 flex-1 items-center gap-3 ${collapsed ? "lg:justify-center lg:gap-0" : ""}`}
          onClick={onMobileClose}
        >
          <OpenScoutLogoMark className="h-14 w-14 shrink-0 sm:h-16 sm:w-16" />
          <span
            className={`truncate font-semibold text-gray-900 transition-opacity duration-200 dark:text-zinc-100 ${
              collapsed ? "lg:pointer-events-none lg:absolute lg:w-0 lg:opacity-0" : labelsVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            OpenScout
          </span>
        </Link>
        <MobileNavToggleButton
          icon="close"
          onClick={onMobileClose}
          className="lg:hidden"
          aria-label="Close menu"
        />
      </div>

      <nav
        className={`
          min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3
          ${collapsed ? "lg:flex lg:flex-col lg:items-center lg:gap-2 lg:px-0 lg:py-4" : "space-y-2"}
        `}
      >
        {navItems.map((item, index) => {
          const isActive = item.href === activeNavHref;
          const IconGlyph = PROFILE_NAV_HREFS.has(item.href) ? (
            <ProfileSidebarIcon className={NAV_ICON_CLASS} aria-hidden />
          ) : DASHBOARD_NAV_HREFS.has(item.href) ? (
            <DashboardSidebarIcon className={NAV_ICON_CLASS} aria-hidden />
          ) : APPLICATIONS_NAV_HREFS.has(item.href) ? (
            <ApplicationsSidebarIcon className={NAV_ICON_CLASS} aria-hidden />
          ) : MOCK_INTERVIEW_NAV_HREFS.has(item.href) ? (
            <MockInterviewSidebarIcon className={NAV_ICON_CLASS} aria-hidden />
          ) : (
            <item.icon className={NAV_ICON_CLASS} weight="regular" aria-hidden />
          );

          if (collapsed) {
            return (
              <Tooltip key={`${item.label}-${item.href}-${index}`} content={item.label} side="right">
                <Link
                  href={item.href}
                  onClick={onMobileClose}
                  className={`
                    flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-medium transition-colors
                    ${isActive ? "bg-primary/12 text-primary ring-1 ring-primary/15 dark:bg-primary/15 dark:ring-primary/20" : "text-gray-600 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800/80"}
                  `}
                >
                  {IconGlyph}
                </Link>
              </Tooltip>
            );
          }

          return (
            <Link
              key={`${item.label}-${item.href}-${index}`}
              href={item.href}
              onClick={onMobileClose}
              className={`
                flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors lg:rounded-lg lg:px-3 lg:py-2.5
                ${isActive ? "bg-primary/12 text-primary ring-1 ring-primary/15 dark:bg-primary/15 dark:ring-primary/20" : "text-gray-600 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800/80"}
              `}
            >
              {IconGlyph}
              <span className="truncate transition-opacity duration-200">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div
        className={`
          shrink-0 border-t border-[var(--border)] dark:border-zinc-700
          ${collapsed ? "lg:flex lg:justify-center lg:px-0 lg:py-4" : "p-3 lg:p-4"}
        `}
      >
        {collapsed ? (
          <Tooltip content="Sign Out" side="right">
            <button
              type="button"
              onClick={onSignOut}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <SignOut className={NAV_ICON_CLASS} weight="regular" aria-hidden />
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={onSignOut}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800 lg:rounded-lg lg:px-3 lg:py-2.5"
          >
            <SignOut className={NAV_ICON_CLASS} weight="regular" aria-hidden />
            <span className={`truncate transition-opacity duration-200 ${labelsVisible ? "opacity-100" : "opacity-0"}`}>
              Sign Out
            </span>
          </button>
        )}
      </div>
    </aside>
  );
}
