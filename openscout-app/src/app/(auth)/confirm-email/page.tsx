"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export default function ConfirmEmailPage() {
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<"idle" | "sent" | "error">("idle");
  const [errorText, setErrorText] = useState<string>("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login?redirect=" + encodeURIComponent(searchParams.get("redirect") || "/dashboard"));
      }
    });
  }, [router, searchParams]);

  async function handleResend() {
    setResending(true);
    setMessage("idle");
    setErrorText("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setMessage("error");
        setErrorText("Session not found.");
        return;
      }
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
      });
      if (error) throw error;
      setMessage("sent");
    } catch (err: unknown) {
      setMessage("error");
      const raw = err instanceof Error ? err.message : String(err);
      const lower = raw.toLowerCase();
      setErrorText(
        lower.includes("rate limit") || lower.includes("rate_limit")
          ? "Too many emails sent. Please wait a few minutes and try again."
          : "Could not resend. Try again later."
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-[10px] border border-[var(--border)] bg-white p-8 shadow-soft">
      <h1 className="text-xl font-bold text-gray-900">Confirm your email</h1>
      <p className="mt-2 text-sm text-gray-600">
        We sent a confirmation link to your email. Click the link to activate your account and continue.
      </p>
      <p className="mt-2 text-sm text-gray-600">
        Didn’t receive the email? Check your spam folder or resend below.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <Button
          variant="primary"
          onClick={handleResend}
          disabled={resending}
        >
          {resending ? "Sending…" : "Resend confirmation email"}
        </Button>
        {message === "sent" && (
          <p className="text-sm text-green-600">Confirmation email sent. Check your inbox.</p>
        )}
        {message === "error" && (
          <p className="text-sm text-red-600">{errorText || "Could not resend. Try again later."}</p>
        )}
        <Link href="/login" className="text-center text-sm text-gray-500 hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
