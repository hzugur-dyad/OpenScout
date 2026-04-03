"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OpenScoutLogoMark } from "@/components/brand/OpenScoutLogoMark";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { MobileNavToggleButton } from "@/components/ui/mobile-nav-toggle-button";

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
    { href: "/faq", label: "FAQ" },
  ];

  return (
    <>
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-transparent pt-2.5 sm:pt-3">
        <nav className="mx-auto flex h-[4.25rem] w-[min(96%,1100px)] items-center justify-between overflow-visible rounded-[1.35rem] border border-black/10 bg-white/55 px-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:h-[4.5rem] sm:rounded-2xl sm:px-8 dark:border-white/10 dark:bg-black/55 dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <div className="flex min-w-0 items-center gap-3 md:gap-8">
            <Link href="/" className="flex min-w-0 items-center gap-2 overflow-visible">
              <div className="flex min-w-0 items-center gap-2 overflow-visible sm:gap-2.5">
                <OpenScoutLogoMark className="h-11 w-11 shrink-0 origin-left sm:h-14 sm:w-14 sm:scale-[1.1]" />
                <span className="truncate text-lg font-semibold tracking-tight text-gray-900 sm:text-xl dark:text-white/95">
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

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button variant="primary" size="sm" className="px-3 sm:px-4">
                  Dashboard
                </Button>
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
                  <Button variant="primary" size="sm" className="px-3 sm:px-4">
                    Sign Up
                  </Button>
                </Link>
              </>
            )}

            <ThemeToggle className="h-11 w-11 rounded-2xl sm:h-9 sm:w-9 sm:rounded-xl" />

            <MobileNavToggleButton
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
              icon={mobileOpen ? "close" : "menu"}
            />
          </div>
        </nav>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mx-auto mt-2.5 w-[min(96%,1100px)] overflow-hidden rounded-[1.4rem] border border-black/10 bg-white/80 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-black/70 dark:shadow-[0_20px_50px_rgba(0,0,0,0.28)] md:hidden"
            >
              <div className="space-y-1.5 px-3 py-3">
                {showUserTypeToggle && (
                  <div className="flex gap-2 px-1 pb-1">
                    <button
                      onClick={() => {
                        onUserTypeChange?.("job_seeker");
                        setMobileOpen(false);
                      }}
                      className={`flex min-h-11 flex-1 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium dark:text-[#E6E6E6] ${
                        userType === "job_seeker" ? "bg-primary text-white" : "bg-gray-100 dark:bg-[#161B1D]"
                      }`}
                    >
                      Find Jobs
                    </button>
                    <button
                      onClick={() => {
                        onUserTypeChange?.("employer");
                        setMobileOpen(false);
                      }}
                      className={`flex min-h-11 flex-1 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium dark:text-[#E6E6E6] ${
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
                    className="block rounded-xl px-4 py-3 text-sm font-medium text-gray-800 transition-colors hover:bg-black/5 hover:text-black dark:text-white/90 dark:hover:bg-white/5 dark:hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

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
