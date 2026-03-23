"use client";

import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import {
  AnimatedDialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";
import { scoutPassTwitterText } from "@/lib/share-scout-pass";

type Props = {
  passUrl: string;
  onClose: () => void;
};

export function ShareScoutScoreModal({ passUrl, onClose }: Props) {
  const [copied, setCopied] = useState<"link" | "linkedin" | "twitter" | null>(null);

  const copy = (text: string, key: "link" | "linkedin" | "twitter") => {
    navigator.clipboard.writeText(text).then(() => {
      trackClient(ANALYTICS_EVENTS.scout_pass_shared, {
        channel: key === "link" ? "modal_copy_link" : key === "linkedin" ? "modal_copy_linkedin_text" : "modal_copy_twitter_text",
      });
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(passUrl)}`;
  const twitterText = scoutPassTwitterText(passUrl);
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}`;

  return (
    <AnimatedDialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPortal forceMount>
        <DialogOverlay />
        <DialogContent>
          <DialogTitle>Share your Scout Score</DialogTitle>
          <DialogDescription className="mt-2">
            Recruiters open one link to see AI-evaluated interview signal and highlights—proof of
            readiness without sharing a full recording.
          </DialogDescription>

          <div className="mt-4">
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">Your Scout Pass link</label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                readOnly
                value={passUrl}
                className="flex-1 min-w-0 rounded-lg border border-[var(--border)] bg-gray-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(passUrl, "link")}
                icon={copied === "link" ? Check : Copy}
                iconPosition="left"
              >
                {copied === "link" ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">Share on</label>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackClient(ANALYTICS_EVENTS.scout_pass_shared, {
                    channel: "linkedin_open",
                    surface: "scout_score_modal",
                  })
                }
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                LinkedIn
              </a>
              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackClient(ANALYTICS_EVENTS.scout_pass_shared, {
                    channel: "twitter_open",
                    surface: "scout_score_modal",
                  })
                }
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                X (Twitter)
              </a>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-zinc-500">
              Tip: copy the suggested lines above, or open LinkedIn / X—your pass URL is included when
              you post from here.
            </p>
          </div>

          <div className="mt-6 flex justify-end">
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </div>
        </DialogContent>
      </DialogPortal>
    </AnimatedDialog>
  );
}
