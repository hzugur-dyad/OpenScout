"use client";

import { useEffect, useState } from "react";
import { Copy, Link2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";
import type { ReferralMyCodeResponse } from "@/lib/types";

export function InviteFriendCard() {
  const [code, setCode] = useState<string | null>(null);
  const [referredCount, setReferredCount] = useState<number>(0);
  const [successfulReferralsCount, setSuccessfulReferralsCount] = useState<number>(0);
  const [bonusBalance, setBonusBalance] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/referral/my-code")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ReferralMyCodeResponse | null) => {
        if (data?.code) {
          setCode(data.code);
          if (typeof data.referredCount === "number") setReferredCount(data.referredCount);
          if (typeof data.successfulReferralsCount === "number") {
            setSuccessfulReferralsCount(data.successfulReferralsCount);
          }
          if (typeof data.bonusInterviewCreditsBalance === "number") {
            setBonusBalance(data.bonusInterviewCreditsBalance);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
        <div className="h-24 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      </div>
    );
  }

  if (!code) return null;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl = `${baseUrl}/register?ref=${code}`;
  const inProgressInvites = Math.max(0, referredCount - successfulReferralsCount);

  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      trackClient(ANALYTICS_EVENTS.referral_link_copied, {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code).then(() => {
      trackClient(ANALYTICS_EVENTS.referral_link_copied, { kind: "code" });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-soft dark:border-white/[0.06] dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--primary-muted)" }}
        >
          <UserPlus className="h-6 w-6" style={{ color: "var(--primary-dark)" }} />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Invite a friend</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            When someone uses your link, signs up, finishes profile onboarding, and completes a full mock interview,
            you both get <span className="font-medium text-gray-700 dark:text-zinc-300">one bonus mock interview</span>{" "}
            credit (on top of your weekly plan limit). Short or abandoned interviews don&apos;t count.
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 rounded-lg border border-[var(--border)] bg-gray-50/80 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-800/50 sm:grid-cols-2">
        <div>
          <dt className="text-gray-500 dark:text-zinc-500">Your referral code</dt>
          <dd className="mt-0.5 font-mono text-base font-semibold tracking-wide text-gray-900 dark:text-zinc-100">
            {code}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-zinc-500">Bonus credits (balance)</dt>
          <dd className="mt-0.5 font-semibold text-gray-900 dark:text-zinc-100">{bonusBalance}</dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-zinc-500">Friends attributed</dt>
          <dd className="mt-0.5 font-semibold text-gray-900 dark:text-zinc-100">{referredCount}</dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-zinc-500">Successful referrals</dt>
          <dd className="mt-0.5 font-semibold text-gray-900 dark:text-zinc-100">{successfulReferralsCount}</dd>
        </div>
      </dl>

      {inProgressInvites > 0 && (
        <p className="mt-3 text-xs text-gray-500 dark:text-zinc-500">
          {inProgressInvites} invite{inProgressInvites !== 1 ? "s" : ""} still in progress (onboarding or qualifying
          interview).
        </p>
      )}

      <p className="mt-3 text-xs text-gray-500 dark:text-zinc-500">
        Status: <span className="font-medium text-gray-600 dark:text-zinc-400">Attributed</span> → signed up with your
        link; <span className="font-medium text-gray-600 dark:text-zinc-400">Qualified</span> → met requirements;
        rewards show as <span className="font-medium text-gray-600 dark:text-zinc-400">Successful</span> here once
        credits are granted.
      </p>

      <div className="mt-4 space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-500">
          Referral link
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            readOnly
            value={inviteUrl}
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-gray-50 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <Button
            variant="primary"
            size="sm"
            className="shrink-0"
            onClick={copyLink}
            icon={Link2}
            iconPosition="left"
          >
            {copied ? "Copied!" : "Copy referral link"}
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={copyCode} icon={Copy} iconPosition="left">
          Copy code only
        </Button>
      </div>
    </div>
  );
}
