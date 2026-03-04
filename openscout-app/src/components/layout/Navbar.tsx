"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";

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
    { href: "/", label: "Job Listings" },
    { href: "/mock-interview", label: "Mock Interview" },
    { href: "/cv-analysis", label: "CV Analysis" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white/95 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--primary-lighter)" }}
          >
            <Compass
              className="h-5 w-5"
              style={{ color: "var(--primary-dark)" }}
            />
          </span>
          <span className="text-xl font-semibold tracking-tight">
            OpenScout
          </span>
        </Link>

        {/* User type toggle - desktop */}
        <div className="hidden items-center gap-8 md:flex">
          <div className="flex items-center rounded-[10px] border border-[var(--border)] p-1">
            <button
              onClick={() => onUserTypeChange?.("job_seeker")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                userType === "job_seeker"
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Find Jobs
            </button>
            <button
              onClick={() => onUserTypeChange?.("employer")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                userType === "employer"
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Ise Aliyorum
            </button>
          </div>

          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "text-primary-dark"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button variant="primary" size="sm">
                Dashboard
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden text-sm font-medium text-gray-600 hover:text-gray-900 sm:block">
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
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-[var(--border)] bg-white md:hidden"
          >
            <div className="space-y-2 px-4 py-4">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onUserTypeChange?.("job_seeker");
                    setMobileOpen(false);
                  }}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm ${
                    userType === "job_seeker" ? "bg-primary-lighter" : ""
                  }`}
                >
                  Find Jobs
                </button>
                <button
                  onClick={() => {
                    onUserTypeChange?.("employer");
                    setMobileOpen(false);
                  }}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm ${
                    userType === "employer" ? "bg-primary-lighter" : ""
                  }`}
                >
                  Ise Aliyorum
                </button>
              </div>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-4 py-2 text-sm hover:bg-gray-50"
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
