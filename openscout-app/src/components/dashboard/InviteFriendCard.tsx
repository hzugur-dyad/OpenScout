"use client";

import { useEffect, useState } from "react";
import { Copy, LinkSimple, UserPlus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";
import type { ReferralMyCodeResponse } from "@/lib/types";

export function InviteFriendCard() {
  const [code, setCode] = useState<string | null>(null);
  const [referredCount, setReferredCount] = useState<number>(0);
  const [successfulReferralsCount, setSuccessfulReferralsCount] = useState<number>(0);
  const [bonusBalance, setBonusBalance] = useState<number>(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [phase, setPhase] = useState<"loading" | "ok" | "unavailable">("loading");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    fetch("/api/referral/my-code")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ReferralMyCodeResponse | null) => {
        if (cancelled) return;
        if (data?.code) {
          setCode(data.code);
          if (typeof data.referredCount === "number") setReferredCount(data.referredCount);
          if (typeof data.successfulReferralsCount === "number") {
            setSuccessfulReferralsCount(data.successfulReferralsCount);
          }
          if (typeof data.bonusInterviewCreditsBalance === "number") {
            setBonusBalance(data.bonusInterviewCreditsBalance);
          }
          setPhase("ok");
        } else {
          setCode(null);
          setPhase("unavailable");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCode(null);
          setPhase("unavailable");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  if (phase === "loading") {
    return (
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-[0_20px_44px_-22px_rgba(15,23,42,0.06)] dark:border-zinc-800/90 dark:bg-zinc-900 dark:shadow-[0_24px_48px_-24px_rgba(0,0,0,0.42)]">
        <div className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      </div>
    );
  }

  if (phase === "unavailable" || !code) {
    return (
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-[0_20px_44px_-22px_rgba(15,23,42,0.06)] dark:border-zinc-800/90 dark:bg-zinc-900 dark:shadow-[0_24px_48px_-24px_rgba(0,0,0,0.42)]">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/[0.11] text-emerald-900 dark:bg-emerald-400/[0.12] dark:text-emerald-300/95">
            <UserPlus className="h-6 w-6" weight="bold" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Invite a friend</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              We couldn&apos;t load your referral link right now. Your account is fine; this is usually temporary.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-5 rounded-lg border-zinc-200 dark:border-zinc-700"
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
            >
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl = `${baseUrl}/register?ref=${code}`;
  const inProgressInvites = Math.max(0, referredCount - successfulReferralsCount);

  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      trackClient(ANALYTICS_EVENTS.referral_link_copied, {});
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code).then(() => {
      trackClient(ANALYTICS_EVENTS.referral_link_copied, { kind: "code" });
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-[0_20px_44px_-22px_rgba(15,23,42,0.06)] dark:border-zinc-800/90 dark:bg-zinc-900 dark:shadow-[0_24px_48px_-24px_rgba(0,0,0,0.42)]">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/[0.11] text-emerald-900 dark:bg-emerald-400/[0.12] dark:text-emerald-300/95">
          <UserPlus className="h-6 w-6" weight="bold" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Invite a friend</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            When someone uses your link, signs up, finishes profile onboarding, and completes a full mock interview,
            you both get{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-200">one bonus mock interview</span> credit
            (on top of your weekly plan limit). Short or abandoned interviews don&apos;t count.
          </p>
        </div>
      </div>

      <dl className="mt-6 grid gap-4 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-5 text-sm dark:border-zinc-800 dark:bg-zinc-950/40 sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500 dark:text-zinc-500">Your referral code</dt>
          <dd className="mt-0.5 font-mono text-base font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">
            {code}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-500">Bonus credits (balance)</dt>
          <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {bonusBalance}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-500">Friends attributed</dt>
          <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {referredCount}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-500">Successful referrals</dt>
          <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {successfulReferralsCount}
          </dd>
        </div>
      </dl>

      {inProgressInvites > 0 && (
        <p className="mt-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
          {inProgressInvites} invite{inProgressInvites !== 1 ? "s" : ""} still in progress (onboarding or qualifying
          interview).
        </p>
      )}

      <p className="mt-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
        Status: <span className="font-medium text-zinc-800 dark:text-zinc-300">Attributed</span> → signed up with your
        link; <span className="font-medium text-zinc-800 dark:text-zinc-300">Qualified</span> → met requirements;
        rewards show as <span className="font-medium text-zinc-800 dark:text-zinc-300">Successful</span> here once
        credits are granted.
      </p>

      <div className="mt-6 space-y-2">
        <label
          htmlFor="referral-link-readonly"
          className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-500"
        >
          Referral link
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="referral-link-readonly"
            type="text"
            readOnly
            value={inviteUrl}
            className="min-w-0 flex-1 rounded-lg border border-zinc-200/90 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          />
          <button
            type="button"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            onClick={copyLink}
          >
            <LinkSimple className="h-4 w-4" weight="bold" aria-hidden />
            {copiedLink ? "Copied" : "Copy referral link"}
          </button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg border-zinc-200 dark:border-zinc-700"
          onClick={copyCode}
        >
          <span className="inline-flex items-center gap-2">
            <Copy className="h-4 w-4 shrink-0" weight="bold" aria-hidden />
            {copiedCode ? "Copied" : "Copy code only"}
          </span>
        </Button>
      </div>
    </div>
  );
}
