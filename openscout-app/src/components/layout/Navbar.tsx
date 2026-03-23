"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hamburger, X } from "@phosphor-icons/react";
import { OpenScoutLogoMark } from "@/components/brand/OpenScoutLogoMark";
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
  const showUserTypeToggle = pathname === "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const navLinks = [
    { href: "/jobs", label: "Job Listings" },
    { href: "/blog", label: "Blog" },
  ];

  return (
    <>
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 bg-transparent pt-3">
        <nav className="mx-auto flex h-[4.5rem] w-[min(96%,1100px)] items-center justify-between overflow-visible rounded-2xl border border-black/10 bg-white/55 px-6 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:px-8 dark:border-white/10 dark:bg-black/55 dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          {/* Left: Logo + nav links */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 overflow-visible">
              <div className="flex items-center gap-2 overflow-visible">
                <OpenScoutLogoMark className="h-14 w-14 origin-left scale-[1.1]" />
                <span className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white/95">
                  OpenScout
                </span>
              </div>
            </Link>

            <div className="hidden items-center gap-5 md:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-lg font-medium transition-colors ${
                    pathname === link.href
                      ? "text-primary-dark"
                      : "text-gray-800 hover:text-black dark:text-white/85 dark:hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right: auth + theme toggle (far-right) */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button variant="primary" size="sm">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden text-lg font-medium text-gray-800 hover:text-black dark:text-white/85 dark:hover:text-white sm:block"
                >
                  Log In
                </Link>
                <Link href="/register">
                  <Button variant="primary" size="sm">Sign Up</Button>
                </Link>
              </>
            )}

            <ThemeToggle />

            <button
              className="text-gray-900 dark:text-white/85 md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <X className="h-6 w-6" weight="regular" aria-hidden />
              ) : (
                <Hamburger className="h-6 w-6" weight="regular" aria-hidden />
              )}
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mx-auto mt-2 w-[min(96%,1100px)] rounded-2xl border border-black/10 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-black/70 md:hidden"
            >
              <div className="space-y-2 px-4 py-4">
                {showUserTypeToggle && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { onUserTypeChange?.("job_seeker"); setMobileOpen(false); }}
                      className={`flex-1 rounded-full px-4 py-2 text-sm font-medium dark:text-[#E6E6E6] ${
                        userType === "job_seeker" ? "bg-primary text-white" : "bg-gray-100 dark:bg-[#161B1D]"
                      }`}
                    >
                      Find Jobs
                    </button>
                    <button
                      onClick={() => { onUserTypeChange?.("employer"); setMobileOpen(false); }}
                      className={`flex-1 rounded-full px-4 py-2 text-sm font-medium dark:text-[#E6E6E6] ${
                        userType === "employer" ? "bg-primary text-white" : "bg-gray-100 dark:bg-[#161B1D]"
                      }`}
                    >
                      I&apos;m Hiring
                    </button>
                  </div>
                )}
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-lg px-4 py-2 text-sm text-gray-800 hover:bg-black/5 hover:text-black dark:text-white/90 dark:hover:bg-white/5 dark:hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Find Jobs / I'm Hiring pill — homepage only, floating below navbar (desktop) ── */}
      {showUserTypeToggle && (
        <div className="relative z-40 hidden justify-center md:flex" style={{ marginTop: -1 }}>
          <div className="absolute top-3">
            <div className="relative flex items-center rounded-full border border-[var(--border)] bg-white/75 p-1 shadow-soft backdrop-blur-md dark:border-white/[0.12] dark:bg-black/25 dark:backdrop-blur-xl">
              <motion.div
                layout
                className="absolute inset-y-1 z-0 rounded-full"
                animate={{ x: userType === "employer" ? "100%" : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
                style={{
                  left: 4,
                  width: "calc(50% - 5px)",
                  backgroundColor: "var(--primary)",
                }}
              />
              <button
                onClick={() => onUserTypeChange?.("job_seeker")}
                className="relative z-10 rounded-full px-5 py-1.5 text-sm font-medium transition-colors"
                style={{ color: userType === "job_seeker" ? "white" : undefined }}
              >
                Find Jobs
              </button>
              <button
                onClick={() => onUserTypeChange?.("employer")}
                className="relative z-10 rounded-full px-5 py-1.5 text-sm font-medium transition-colors"
                style={{ color: userType === "employer" ? "white" : undefined }}
              >
                I&apos;m Hiring
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
