"use client";

import { useEffect } from "react";

export function ReferralAttribute() {
  useEffect(() => {
    let ref: string | null = null;
    try {
      ref = sessionStorage.getItem("referral_ref");
    } catch {}
    if (!ref) return;

    fetch("/api/referral/attribute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: ref }),
    })
      .then(() => {
        try {
          sessionStorage.removeItem("referral_ref");
        } catch {}
      })
      .catch(() => {});
  }, []);
  return null;
}
