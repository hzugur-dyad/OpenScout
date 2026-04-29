"use client";

import { useEffect, useRef } from "react";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";

export function EmployerPricingTelemetry({
  currentPlan,
}: {
  currentPlan: string;
}) {
  const didTrackViewRef = useRef(false);

  useEffect(() => {
    if (didTrackViewRef.current) return;
    didTrackViewRef.current = true;
    trackClient(ANALYTICS_EVENTS.pricing_viewed, {
      surface: "employer_pricing",
      current_plan: currentPlan,
    });
  }, [currentPlan]);

  return null;
}
