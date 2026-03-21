"use client";

import { useState } from "react";
import { ShareNetwork } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";
import { captureException } from "@/lib/monitoring";

type Props = {
  variant?: "outline" | "primary";
  size?: "sm" | "md" | "lg";
  /** Editorial minimal chrome (dashboard home): crisp border, flat outline. */
  minimal?: boolean;
};

export function SharePublicProfileButton({
  variant = "outline",
  size = "sm",
  minimal = false,
}: Props) {
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
      });

      if (typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: "My OpenScout profile",
            text: "View my candidate profile on OpenScout",
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

      setMsg("Link copied to clipboard");
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
        icon={ShareNetwork}
        iconPosition="left"
        onClick={handleClick}
        disabled={busy}
        className={cn(
          minimal &&
            variant === "outline" &&
            "rounded-md border-[#EAEAEA] bg-transparent text-[#111111] shadow-none hover:bg-white hover:text-[#111111] dark:border-white/[0.12] dark:text-neutral-100 dark:hover:bg-white/[0.06]"
        )}
      >
        {busy ? "Working…" : "Share your profile"}
      </Button>
      {msg && (
        <span
          className={cn(
            "text-xs leading-[1.6] text-[#787774] dark:text-[#A09C98]",
            minimal && "max-w-md"
          )}
          role="status"
          aria-live="polite"
        >
          {msg}
        </span>
      )}
    </div>
  );
}
