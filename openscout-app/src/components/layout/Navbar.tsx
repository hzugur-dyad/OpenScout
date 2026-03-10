"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

type UserType = "job_seeker" | "employer";

interface NavbarProps {
  userType?: UserType;
  onUserTypeChange?: (type: UserType) => void;
  isAuthenticated?: boolean;
}

export function Navbar({
  userType = "job_seeker",
  onUserTypeChange,
  isAuthenticated = false,
}: NavbarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: "/jobs", label: "Job Listings" },
    { href: "/blog", label: "Blog" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white/95 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--primary-lighter)" }}
          >
            <Compass
              className="h-5 w-5"
              style={{ color: "var(--primary-dark)" }}
            />
          </span>
          <span className="text-xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100">
            OpenScout
          </span>
        </Link>

        {/* User type toggle - desktop, centered */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center md:flex">
          <div className="relative flex items-center rounded-[10px] border border-[var(--border)] bg-gray-50/80 p-1 dark:border-zinc-700 dark:bg-zinc-800/80">
            <motion.div
              layout
              animate={{ x: userType === "employer" ? "100%" : 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="absolute inset-y-0 z-0 rounded-lg"
              style={{
                left: 4,
                width: "calc(50% - 6px)",
                backgroundColor: "var(--primary)",
              }}
            />
            <button
              onClick={() => onUserTypeChange?.("job_seeker")}
              className="relative z-10 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={{
                color: userType === "job_seeker" ? "white" : undefined,
              }}
            >
              Find Jobs
            </button>
            <button
              onClick={() => onUserTypeChange?.("employer")}
              className="relative z-10 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={{
                color: userType === "employer" ? "white" : undefined,
              }}
            >
              I'm Hiring
            </button>
          </div>
        </div>

        {/* Job Listings, Blog + auth - right side */}
        <div className="flex flex-1 items-center justify-end gap-6">
          <div className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "text-primary-dark"
                    : "text-gray-600 hover:text-gray-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button variant="primary" size="sm">
                Dashboard
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-zinc-300 dark:hover:text-zinc-100 sm:block">
                Log In
              </Link>
              <Link href="/register">
                <Button variant="primary" size="sm">
                  Sign Up
                </Button>
              </Link>
            </>
          )}

          <button
            className="md:hidden text-gray-700 dark:text-zinc-200"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-[var(--border)] bg-white dark:border-zinc-700 dark:bg-zinc-900 md:hidden"
          >
            <div className="space-y-2 px-4 py-4">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onUserTypeChange?.("job_seeker");
                    setMobileOpen(false);
                  }}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm dark:text-zinc-200 ${
                    userType === "job_seeker" ? "bg-primary-lighter dark:bg-primary-muted" : ""
                  }`}
                >
                  Find Jobs
                </button>
                <button
                  onClick={() => {
                    onUserTypeChange?.("employer");
                    setMobileOpen(false);
                  }}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm dark:text-zinc-200 ${
                    userType === "employer" ? "bg-primary-lighter dark:bg-primary-muted" : ""
                  }`}
                >
                  I'm Hiring
                </button>
              </div>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
