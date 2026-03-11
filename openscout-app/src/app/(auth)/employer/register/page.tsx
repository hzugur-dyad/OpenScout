"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Compass } from "lucide-react";
import { CustomSelect } from "@/components/ui/CustomSelect";

const PENDING_EMPLOYER_KEY = "pending_employer_company";
const PENDING_EMPLOYER_SECTOR = "pending_employer_sector";

const SECTORS = [
  "Technology",
  "Finance",
  "Healthcare",
  "Education",
  "Retail",
  "Manufacturing",
  "Marketing & Advertising",
  "Legal",
  "Real Estate",
  "Other",
] as const;

export default function EmployerRegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [sector, setSector] = useState<string>(SECTORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function completeEmployerRegistration(userId: string, name: string, sec: string) {
    await supabase.from("companies").insert({
      name,
      user_id: userId,
      sector: sec,
      trial_started_at: new Date().toISOString(),
    });
    await supabase.from("profiles").update({ role: "employer" }).eq("user_id", userId);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (!companyName.trim()) {
      setError("Company name is required");
      return;
    }
    setIsLoading(true);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?next=/employer`
          : undefined;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
        },
      });
      if (signUpError) throw signUpError;

      const name = companyName.trim();
      const sec = sector;
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(PENDING_EMPLOYER_KEY, name);
          sessionStorage.setItem(PENDING_EMPLOYER_SECTOR, sec);
        } catch {}
      }

      if (data?.user && !data?.session) {
        setError(null);
        setSuccess(true);
        return;
      }

      if (data?.user && data?.session) {
        await completeEmployerRegistration(data.user.id, name, sec);
        if (typeof window !== "undefined") {
          try {
            sessionStorage.removeItem(PENDING_EMPLOYER_KEY);
          } catch {}
        }
        router.push("/employer");
        router.refresh();
        return;
      }

      router.push("/employer");
      router.refresh();
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      const lower = raw.toLowerCase();
      const msg =
        lower.includes("rate limit") || lower.includes("rate_limit")
          ? "Too many sign-up attempts. Please wait a few minutes and try again, or try again later."
          : raw;
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--primary-lighter)]/30 px-4 dark:bg-transparent">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--primary)" }}
          >
            <Compass className="h-6 w-6 text-white" />
          </span>
          <span className="text-2xl font-bold text-gray-900 dark:text-zinc-100">OpenScout</span>
        </Link>

        <div className="rounded-[10px] border border-[var(--border)] bg-white p-8 shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
          <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-zinc-100">Employer Sign Up</h1>
          <p className="mb-6 text-gray-500 dark:text-zinc-400">Create an employer account and add your company</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {success && (
              <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/50 dark:text-green-400">
                Check your email and click the confirmation link, then sign in at Employer Log In.
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="companyName" className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">
                Company name
              </label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className="w-full rounded-[10px] border border-[var(--border)] bg-white px-4 py-2.5 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
                placeholder="Acme Inc."
              />
            </div>
            <div>
              <label htmlFor="sector" className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">
                Sector
              </label>
              <CustomSelect
                id="sector"
                options={[...SECTORS]}
                value={sector}
                onChange={setSector}
                aria-label="Sector"
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-[10px] border border-[var(--border)] bg-white px-4 py-2.5 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-[10px] border border-[var(--border)] bg-white px-4 py-2.5 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-[10px] border border-[var(--border)] bg-white px-4 py-2.5 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isLoading}
            >
              Sign Up
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-zinc-400">
            Looking for a job?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Sign up as candidate
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
