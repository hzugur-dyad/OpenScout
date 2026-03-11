"use client";

import { useEffect, useState } from "react";
import { Copy, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ReferralMyCodeResponse } from "@/lib/types";

export function InviteFriendCard() {
  const [code, setCode] = useState<string | null>(null);
  const [referredCount, setReferredCount] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referral/my-code")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ReferralMyCodeResponse | null) => {
        if (data?.code) {
          setCode(data.code);
          if (typeof data.referredCount === "number") setReferredCount(data.referredCount);
        }
      })
      .catch(() => {});
  }, []);

  if (!code) return null;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl = `${baseUrl}/register?ref=${code}`;

  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--primary-muted)" }}
        >
          <UserPlus className="h-6 w-6" style={{ color: "var(--primary-dark)" }} />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Invite a friend</h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Share your link. When they complete their Scout Score, we&apos;ll reward you — rewards coming soon.
          </p>
          {referredCount > 0 && (
            <p className="mt-1 text-xs font-medium text-gray-600 dark:text-zinc-400">
              You&apos;ve invited {referredCount} friend{referredCount !== 1 ? "s" : ""}.
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          readOnly
          value={inviteUrl}
          className="flex-1 min-w-0 rounded-lg border border-[var(--border)] bg-gray-50 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
        <Button variant="outline" size="sm" onClick={copyLink} icon={Copy} iconPosition="left">
          {copied ? "Copied!" : "Copy link"}
        </Button>
      </div>
    </div>
  );
}
