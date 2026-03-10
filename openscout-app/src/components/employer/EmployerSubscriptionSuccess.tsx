"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function EmployerSubscriptionSuccess() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const subscription = searchParams.get("subscription");
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (subscription !== "success" || !sessionId) return;

    setActivating(true);
    setError(null);
    let cancelled = false;
    fetch("/api/employer/verify-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then(async (res) => {
        if (cancelled) return;
        const data = await res.json().catch(() => ({}));
        setActivating(false);
        if (res.ok) {
          router.replace("/employer");
          return;
        }
        setError(
          data.error || (res.status >= 500 ? "Server error. If your card was charged, we will activate your plan shortly—try refreshing." : "Could not activate subscription.")
        );
      })
      .catch(() => {
        if (!cancelled) {
          setActivating(false);
          setError("Network error. If your card was charged, refresh this page or contact support.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, subscription, router]);

  if (activating) {
    return (
      <div className="mb-6 rounded-[10px] border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
        Activating your subscription…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-6 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-medium text-amber-800">{error}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Retry
          </Button>
          <Link href="/employer">
            <Button variant="outline" size="sm">Back to employer</Button>
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
