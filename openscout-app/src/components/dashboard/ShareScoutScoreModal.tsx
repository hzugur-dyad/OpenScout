"use client";

import { useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";

const LINKEDIN_TEXT = (url: string) =>
  `I got my Scout Score on OpenScout — one credential, many companies. Stand out to employers with an AI-verified profile. Get yours: ${url}`;

const TWITTER_TEXT = (url: string) =>
  `Just got my Scout Score on OpenScout. One credential, many companies. Get yours: ${url}`;

type Props = {
  passUrl: string;
  onClose: () => void;
};

export function ShareScoutScoreModal({ passUrl, onClose }: Props) {
  const [copied, setCopied] = useState<"link" | "linkedin" | "twitter" | null>(null);

  const copy = (text: string, key: "link" | "linkedin" | "twitter") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(passUrl)}`;
  const twitterText = TWITTER_TEXT(passUrl);
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Share your Scout Score</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          One credential, many companies. Share so employers can see your AI-verified score.
        </p>

        <div className="mt-4">
          <label className="text-xs font-medium text-gray-500">Your Scout Pass link</label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              readOnly
              value={passUrl}
              className="flex-1 min-w-0 rounded-lg border border-[var(--border)] bg-gray-50 px-3 py-2 text-sm"
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
          <label className="text-xs font-medium text-gray-500">Share on</label>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              LinkedIn
            </a>
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              X (Twitter)
            </a>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Suggested text: &ldquo;I got my Scout Score on OpenScout — one credential, many companies. Get yours: [your link]&rdquo;
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
