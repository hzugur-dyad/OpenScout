"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Compass } from "lucide-react";

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
      const msg = err instanceof Error ? err.message : "Error signing in";
      setError(String(msg));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--primary-lighter)]/30 px-4 dark:bg-zinc-950">
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
                className="w-full rounded-[10px] border border-[var(--border)] bg-white px-4 py-2.5 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
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
                className="w-full rounded-[10px] border border-[var(--border)] bg-white px-4 py-2.5 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
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
