"use client";

import { useState } from "react";
import { ShareNetwork } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";
import { captureException } from "@/lib/monitoring";

type Props = {
  variant?: "outline" | "primary";
  size?: "sm" | "md" | "lg";
  /** PostHog: e.g. dashboard_header | dashboard_growth | onboarding */
  surface?: string;
};

export function SharePublicProfileButton({ variant = "outline", size = "sm", surface }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/candidate/public-profile-link");
      const j = (await res.json()) as {
        profileUrl?: string;
        analytics?: { role: string | null; best_score: number | null };
        error?: string;
      };
      if (!res.ok || !j.profileUrl) {
        setMsg(j.error ?? "Could not get your profile link.");
        return;
      }

      try {
        await navigator.clipboard.writeText(j.profileUrl);
      } catch {
        setMsg("Could not copy to clipboard.");
        return;
      }

      trackClient(ANALYTICS_EVENTS.public_profile_shared, {
        role: j.analytics?.role ?? "unknown",
        best_score: j.analytics?.best_score ?? null,
        ...(surface ? { surface } : {}),
      });

      if (typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: "OpenScout — candidate profile",
            text: "AI-evaluated profile with Scout Score and hiring signal—open my public page:",
            url: j.profileUrl,
          });
        } catch (shareErr) {
          if (!(shareErr instanceof DOMException && shareErr.name === "AbortError")) {
            captureException(shareErr, {
              route: "SharePublicProfileButton",
              tags: { share_phase: "navigator.share" },
            });
          }
        }
      }

      setMsg("Copied — link ready to paste");
    } catch (e) {
      captureException(e, { route: "SharePublicProfileButton" });
      setMsg("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={busy}
        className="rounded-[10px] border-zinc-200/90 transition-[border-color,background-color,transform] duration-200 ease-[cubic-bezier(0.33,1,0.68,1)] hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
      >
        <span className="inline-flex items-center gap-2">
          <ShareNetwork className="h-4 w-4 shrink-0" weight="bold" aria-hidden />
          {busy ? "Working…" : "Share your profile"}
        </span>
      </Button>
      {msg && (
        <span className="text-xs font-normal leading-[1.5] text-zinc-900/50 dark:text-zinc-500">{msg}</span>
      )}
    </div>
  );
}
