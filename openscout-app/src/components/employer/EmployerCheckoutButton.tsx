"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@phosphor-icons/react";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";

type Plan = "growth" | "scale";

export function EmployerCheckoutButton({ plan, companyId }: { plan: Plan; companyId?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
    trackClient(ANALYTICS_EVENTS.upgrade_clicked, {
      surface: "employer_pricing",
      target_plan: plan,
      company_id: companyId,
    });
    try {
      const res = await fetch("/api/employer/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, ...(companyId && { company_id: companyId }) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = res.status === 503
          ? "Payment setup is not available right now. Please try again later or contact us."
          : (data.error || "Something went wrong");
        setError(msg);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("No checkout URL returned");
    } catch (e) {
      setError("Failed to start checkout. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <Button
        variant="primary"
        className="w-full"
        onClick={handleSubscribe}
        disabled={loading}
        isLoading={loading}
      >
        {loading ? (
          <>
            <Spinner className="h-4 w-4 animate-spin" weight="regular" aria-hidden />
            Redirecting…
          </>
        ) : (
          "Subscribe with Stripe"
        )}
      </Button>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
