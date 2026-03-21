"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";
import { Button } from "@/components/ui/Button";
import { Compass, Check } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const signupStartedTracked = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref && typeof window !== "undefined") {
      try {
        sessionStorage.setItem("referral_ref", ref.trim());
      } catch {}
    }
  }, [searchParams]);

  useEffect(() => {
    if (signupStartedTracked.current) return;
    signupStartedTracked.current = true;
    trackClient(ANALYTICS_EVENTS.auth_signup_started, { role: "candidate" });
  }, []);

  const inputClass =
    "w-full rounded-[10px] border border-[var(--border)] bg-white px-4 py-2.5 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500";

  async function handleSubmit() {
    setError(null);
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
        },
      });
      if (signUpError) throw signUpError;

      if (data?.user) {
        trackClient(ANALYTICS_EVENTS.auth_signup_completed, {
          role: "candidate",
          email_confirmation_pending: !data.session,
        });
      }

      if (data?.user && !data?.session) {
        setSuccess(true);
        return;
      }

      if (data?.user && data?.session) {
        router.push("/onboarding");
        router.refresh();
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      const lower = raw.toLowerCase();
      setError(
        lower.includes("rate limit") || lower.includes("rate_limit")
          ? "Too many sign-up attempts. Please wait a few minutes and try again."
          : raw
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
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
          <div className="rounded-[10px] border border-[var(--border)] bg-white p-8 text-center shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Check your email</h1>
            <p className="mt-2 text-gray-500 dark:text-zinc-400">
              We sent a confirmation link to <strong>{email}</strong>. After you confirm, sign in and you&apos;ll finish
              your profile in one place—no second signup form.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--primary-lighter)]/30 px-4 py-8 dark:bg-transparent">
      <div className="w-full max-w-lg">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--primary)" }}
          >
            <Compass className="h-6 w-6 text-white" />
          </span>
          <span className="text-2xl font-bold text-gray-900 dark:text-zinc-100">OpenScout</span>
        </Link>

        {searchParams.get("ref")?.trim() ? (
          <p
            className="mb-4 rounded-lg border border-[var(--primary)]/25 bg-[var(--primary-muted)]/40 px-4 py-2.5 text-center text-sm text-gray-800 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-200"
            role="status"
          >
            You&apos;re signing up with an invite link.
          </p>
        ) : null}

        <div className="rounded-[10px] border border-[var(--border)] bg-white p-8 shadow-card dark:border-white/[0.06] dark:bg-zinc-900">
          <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-zinc-100">Create your account</h1>
          <p className="mb-6 text-sm text-gray-500 dark:text-zinc-400">
            Use email and password only. You&apos;ll add your profile and CV next on the profile setup page.
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={inputClass}
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <Button variant="primary" onClick={handleSubmit} isLoading={isLoading}>
              Create account
            </Button>
          </div>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-zinc-400">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-zinc-400">
            Hiring?{" "}
            <Link href="/employer/register" className="font-medium text-primary hover:underline">
              Register as employer
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
