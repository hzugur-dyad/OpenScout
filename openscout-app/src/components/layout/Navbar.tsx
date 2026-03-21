"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { OpenScoutLogoMark } from "@/components/brand/OpenScoutLogoMark";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useHeroEntranceOptional } from "@/contexts/HeroEntranceContext";

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
  const heroEntrance = useHeroEntranceOptional();
  const phase = heroEntrance?.phase ?? "content";
  const isAnimating = phase === "centered";

  const navLinks = [
    { href: "/jobs", label: "Job Listings" },
    { href: "/blog", label: "Blog" },
  ];

  return (
    <>
      {/* ── Navbar ── */}
      <header
        className={`sticky top-0 z-50 border-b border-[var(--border)] bg-white/95 backdrop-blur transition-opacity duration-300 dark:border-[#111] dark:bg-black ${
          isAnimating ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between overflow-visible px-4 sm:px-6 lg:px-8">
          {/* Left: Logo + nav links */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 overflow-visible">
              <motion.div
                layoutId="hero-logo"
                className="flex items-center gap-2 overflow-visible"
                transition={{ layout: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }}
              >
                <OpenScoutLogoMark className="h-16 w-16 origin-left scale-[1.22]" />
                <span className="text-xl font-semibold tracking-tight text-gray-900 dark:text-[#E6E6E6]">
                  OpenScout
                </span>
              </motion.div>
            </Link>

            <motion.div
              className="hidden items-center gap-5 md:flex"
              initial={phase !== "content" ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? "text-primary-dark"
                      : "text-gray-500 hover:text-gray-900 dark:text-[#A1A1AA] dark:hover:text-[#E6E6E6]"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </motion.div>
          </div>

          {/* Right: auth + theme toggle (far-right) */}
          <motion.div
            className="flex items-center gap-3"
            initial={phase !== "content" ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button variant="primary" size="sm">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-[#A1A1AA] dark:hover:text-[#E6E6E6] sm:block"
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
              className="text-gray-700 dark:text-[#E6E6E6] md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </motion.div>
        </nav>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-[var(--border)] bg-white dark:border-[#111] dark:bg-black md:hidden"
            >
              <div className="space-y-2 px-4 py-4">
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
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:text-[#A1A1AA] dark:hover:bg-[#161B1D]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Find Jobs / I'm Hiring pill — floating, centered below navbar (desktop only) ── */}
      <motion.div
        className="relative z-40 hidden justify-center md:flex"
        style={{ marginTop: -1 }}
        initial={phase !== "content" ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <div className="absolute top-3">
          <div className="relative flex items-center rounded-full border border-[var(--border)] bg-white/90 p-1 shadow-soft backdrop-blur dark:border-[#23292C] dark:bg-[#111]">
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
      </motion.div>
    </>
  );
}
