"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ShareNetwork } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";
import { scoutPassTwitterText } from "@/lib/share-scout-pass";

type Props = {
  slug: string;
  jobCategory: string;
};

export function ScoutPassSharePanel({ slug, jobCategory }: Props) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  const shareUrl = useMemo(() => {
    if (!origin || !slug) return "";
    try {
      const u = new URL(`/pass/${encodeURIComponent(slug)}`, origin);
      u.searchParams.set("utm_source", "openscout");
      u.searchParams.set("utm_medium", "share");
      u.searchParams.set("utm_campaign", "scout_pass");
      return u.href;
    } catch {
      return `${origin}/pass/${encodeURIComponent(slug)}`;
    }
  }, [origin, slug]);

  const text = useMemo(() => (shareUrl ? scoutPassTwitterText(shareUrl) : ""), [shareUrl]);

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      trackClient(ANALYTICS_EVENTS.scout_pass_shared, {
        channel: "copy_link",
        surface: "public_pass_page",
        job_category: jobCategory,
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const nativeShare = async () => {
    if (!shareUrl) return;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "Scout Score — OpenScout",
          text: text,
          url: shareUrl,
        });
        trackClient(ANALYTICS_EVENTS.scout_pass_shared, {
          channel: "native",
          surface: "public_pass_page",
          job_category: jobCategory,
        });
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        /* ignore */
      }
    }
  };

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  if (!shareUrl) {
    return null;
  }

  return (
    <div className="os-surface-card mt-8 border border-[var(--border)] p-6 dark:border-white/[0.08]">
      <div className="flex items-center gap-2">
        <ShareNetwork className="h-5 w-5 text-zinc-600 dark:text-zinc-400" weight="regular" aria-hidden />
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Share this credential</h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Forward the same link you opened—viewers see verified scores and highlights, useful for
        referrals, intros, and recruiter follow-ups.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          readOnly
          value={shareUrl}
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <Button
          variant="primary"
          size="sm"
          icon={copied ? Check : Copy}
          iconPosition="left"
          onClick={() => void copyLink()}
        >
          {copied ? "Copied" : "Copy link"}
        </Button>
        {canNativeShare && (
          <Button variant="outline" size="sm" onClick={() => void nativeShare()}>
            Share sheet…
          </Button>
        )}
      </div>
    </div>
  );
}
