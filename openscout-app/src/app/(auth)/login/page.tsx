"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { OpenScoutLogoMark } from "@/components/brand/OpenScoutLogoMark";
import { mapSupabaseAuthError } from "@/lib/user-facing-errors";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    if (searchParams.get("error") === "auth_callback") {
      setError("Email confirmation failed or link expired. Try signing in again or request a new confirmation.");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const redirectTo = searchParams.get("redirect") ?? "/dashboard";
      const safeRedirect =
        redirectTo.startsWith("/") && !redirectTo.startsWith("//") && !redirectTo.includes("://")
          ? redirectTo
          : "/dashboard";
      router.push(safeRedirect);
      router.refresh();
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Error signing in";
      setError(mapSupabaseAuthError(raw));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--primary-lighter)]/30 px-4 dark:bg-transparent">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <OpenScoutLogoMark className="h-20 w-20" />
          <span className="text-2xl font-bold text-gray-900 dark:text-zinc-100">OpenScout</span>
        </Link>

        <div className="rounded-[10px] border border-[var(--border)] bg-white p-8 shadow-card dark:border-white/[0.12] dark:bg-black/25 dark:backdrop-blur-xl">
          <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-zinc-100">Log In</h1>
          <p className="mb-6 text-gray-500 dark:text-zinc-400">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-[10px] border border-[var(--border)] bg-white px-4 py-2.5 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/[0.18] dark:bg-black/30 dark:text-zinc-100 dark:placeholder-zinc-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-[10px] border border-[var(--border)] bg-white px-4 py-2.5 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/[0.18] dark:bg-black/30 dark:text-zinc-100"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isLoading}
            >
              Log In
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-zinc-400">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-zinc-400">
            I&apos;m an employer{" "}
            <Link href="/employer/login" className="font-medium text-primary hover:underline">
              Log in as employer
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
