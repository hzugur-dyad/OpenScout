"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Compass, X, LogOut, type LucideIcon } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";

export type NavItem = { href: string; label: string; icon: LucideIcon };

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

  return (
    <aside
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={`
        fixed left-0 top-0 z-50 flex h-screen shrink-0 flex-col overflow-x-hidden
        border-r border-[var(--border)] bg-white
        transition-[width] duration-200 ease-in-out
        dark:border-zinc-800 dark:bg-black
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0
        ${collapsed ? "lg:w-[72px]" : "lg:w-[240px]"}
        w-[240px]
      `}
    >
      {/* Header: logo only (no toggle - hover expands) */}
      <div
        className={`
          flex h-16 shrink-0 items-center border-b border-[var(--border)] dark:border-zinc-800
          ${collapsed ? "lg:justify-center lg:px-0" : "px-4"}
        `}
      >
        <Link
          href={dashboardHref}
          className={`flex min-w-0 items-center gap-3 ${collapsed ? "lg:justify-center lg:gap-0" : ""}`}
          onClick={onMobileClose}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--primary)" }}
          >
            <Compass className="h-5 w-5 text-white" />
          </span>
          <span
            className={`font-semibold text-gray-900 dark:text-zinc-100 truncate transition-opacity duration-200 ${
              collapsed ? "lg:opacity-0 lg:pointer-events-none lg:absolute lg:w-0" : labelsVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            OpenScout
          </span>
        </Link>
        <button
          type="button"
          onClick={onMobileClose}
          className="lg:hidden shrink-0 text-gray-600 hover:text-gray-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          aria-label="Close menu"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Nav links */}
      <nav
        className={`
          min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4
          ${collapsed ? "lg:flex lg:flex-col lg:items-center lg:gap-2 lg:px-0 lg:py-4" : "space-y-1"}
        `}
      >
        {navItems.map((item, index) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          if (collapsed) {
            return (
              <Tooltip key={`${item.label}-${item.href}-${index}`} content={item.label} side="right">
                <Link
                  href={item.href}
                  onClick={onMobileClose}
                  className={`
                    flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-medium transition-colors
                    ${isActive ? "bg-primary/10 text-primary" : "text-gray-600 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}
                  `}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
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
                flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                ${isActive ? "bg-primary/10 text-primary" : "text-gray-600 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}
              `}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="truncate transition-opacity duration-200">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sign out - aligned with icon grid when collapsed */}
      <div
        className={`
          shrink-0 border-t border-[var(--border)] dark:border-zinc-700
          ${collapsed ? "lg:flex lg:justify-center lg:px-0 lg:py-4" : "p-4"}
        `}
      >
        {collapsed ? (
          <Tooltip content="Sign Out" side="right">
            <button
              type="button"
              onClick={onSignOut}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <LogOut className="h-5 w-5 shrink-0" />
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className={`truncate transition-opacity duration-200 ${labelsVisible ? "opacity-100" : "opacity-0"}`}>Sign Out</span>
          </button>
        )}
      </div>
    </aside>
  );
}
