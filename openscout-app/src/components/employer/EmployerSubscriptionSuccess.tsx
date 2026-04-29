"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";

const PURCHASE_VALUES_BY_PLAN: Record<string, number> = {
  growth: 99,
  scale: 149,
};

export function EmployerSubscriptionSuccess() {
  const router = useRouter();
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryState, setQueryState] = useState(() => ({
    sessionId: "",
    subscription: "",
    plan: "",
  }));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQueryState({
      sessionId: params.get("session_id") ?? "",
      subscription: params.get("subscription") ?? "",
      plan: params.get("plan") ?? "",
    });
  }, []);

  const trackingKey = useMemo(
    () => (queryState.sessionId ? `openscout.purchase.employer.${queryState.sessionId}` : null),
    [queryState.sessionId]
  );

  useEffect(() => {
    if (queryState.subscription !== "success" || !queryState.sessionId) return;

    setActivating(true);
    setError(null);
    let cancelled = false;
    fetch("/api/employer/verify-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: queryState.sessionId }),
    })
      .then(async (res) => {
        if (cancelled) return;
        const data = await res.json().catch(() => ({}));
        setActivating(false);
        if (res.ok) {
          if (trackingKey && !window.sessionStorage.getItem(trackingKey)) {
            window.sessionStorage.setItem(trackingKey, "1");
            trackClient(
              ANALYTICS_EVENTS.purchase_completed,
              {
                scope: "employer",
                plan: queryState.plan,
                ...(queryState.plan && PURCHASE_VALUES_BY_PLAN[queryState.plan]
                  ? { value: PURCHASE_VALUES_BY_PLAN[queryState.plan] }
                  : {}),
                checkout_session_id: queryState.sessionId,
              },
              { posthog: false }
            );
          }
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
  }, [queryState.plan, queryState.sessionId, queryState.subscription, router, trackingKey]);

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
