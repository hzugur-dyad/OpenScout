"use client";

import { useEffect, useState } from "react";
import { Copy, LinkSimple, UserPlus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { ANALYTICS_EVENTS, trackClient } from "@/lib/analytics";
import type { ReferralMyCodeResponse } from "@/lib/types";

const cardShell =
  "rounded-lg border border-[#EAEAEA] bg-[#FFFFFF] p-6 shadow-none transition-shadow duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-white/[0.08] dark:bg-[#141414] dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.2)]";

const loadingShell =
  "rounded-lg border border-[#EAEAEA] bg-[#FFFFFF] p-6 dark:border-white/[0.08] dark:bg-[#141414]";

export function InviteFriendCard() {
  const [code, setCode] = useState<string | null>(null);
  const [referredCount, setReferredCount] = useState<number>(0);
  const [successfulReferralsCount, setSuccessfulReferralsCount] = useState<number>(0);
  const [bonusBalance, setBonusBalance] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [phase, setPhase] = useState<"loading" | "ok" | "unavailable">("loading");
  const [retryKey, setRetryKey] = useState(0);
  const [clipboardMessage, setClipboardMessage] = useState<string | null>(null);

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
      <div className={loadingShell} aria-busy="true" aria-label="Loading referral">
        <div className="flex gap-6">
          <div className="h-14 w-14 shrink-0 motion-reduce:animate-none animate-pulse rounded-lg bg-[#F7F6F3] dark:bg-zinc-800" />
          <div className="min-w-0 flex-1 space-y-3 pt-1">
            <div className="h-4 w-40 motion-reduce:animate-none animate-pulse rounded bg-[#F7F6F3] dark:bg-zinc-800" />
            <div className="h-3 w-full max-w-lg motion-reduce:animate-none animate-pulse rounded bg-[#F7F6F3] dark:bg-zinc-800" />
            <div className="h-3 max-w-md w-[92%] motion-reduce:animate-none animate-pulse rounded bg-[#F7F6F3] dark:bg-zinc-800" />
          </div>
        </div>
      </div>
    );
  }

  if (phase === "unavailable" || !code) {
    return (
      <div className={cardShell}>
        <div className="flex items-start gap-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#EAEAEA] bg-[#FBF3DB] dark:border-[#3d3520] dark:bg-[#2a2618]">
            <UserPlus className="h-6 w-6 text-[#956400] dark:text-[#E8D4A8]" weight="bold" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold leading-snug tracking-tight text-zinc-950 dark:text-zinc-50">
              Invite a friend
            </h3>
            <p className="mt-2 text-sm leading-[1.6] text-[#787774] dark:text-[#A09C98]">
              We couldn&apos;t load your referral link right now. Your account is fine — this is usually temporary.
            </p>
            <Button
              variant="outline"
              size="md"
              className="mt-6 min-h-11 rounded-md border-[#EAEAEA] bg-transparent text-[#111111] hover:bg-[#F7F6F3] dark:border-white/[0.12] dark:text-neutral-100 dark:hover:bg-white/[0.06]"
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

  const copyLink = async () => {
    setClipboardMessage(null);
    try {
      await navigator.clipboard.writeText(inviteUrl);
      trackClient(ANALYTICS_EVENTS.referral_link_copied, {});
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setClipboardMessage("Could not copy the link. Select the field and copy manually, or try again.");
      window.setTimeout(() => setClipboardMessage(null), 5000);
    }
  };

  const copyCode = async () => {
    setClipboardMessage(null);
    try {
      await navigator.clipboard.writeText(code);
      trackClient(ANALYTICS_EVENTS.referral_link_copied, { kind: "code" });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setClipboardMessage("Could not copy the code. Select it above and copy manually, or try again.");
      window.setTimeout(() => setClipboardMessage(null), 5000);
    }
  };

  return (
    <div className={cardShell}>
      <div className="flex items-start gap-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#EAEAEA] bg-[#FBF3DB] dark:border-[#3d3520] dark:bg-[#2a2618]">
          <UserPlus className="h-6 w-6 text-[#956400] dark:text-[#E8D4A8]" weight="bold" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-snug tracking-tight text-zinc-950 dark:text-zinc-50">
            Invite a friend
          </h3>
          <p className="mt-2 text-sm leading-[1.6] text-[#787774] dark:text-[#A09C98]">
            When someone uses your link, signs up, finishes profile onboarding, and completes a full mock interview,
            you both get <span className="font-medium text-[#111111] dark:text-[#FAFAFA]">one bonus mock interview</span>{" "}
            credit (on top of your weekly plan limit). Short or abandoned interviews don&apos;t count.
          </p>
        </div>
      </div>

      <dl className="mt-10 grid gap-px rounded-lg border border-[#EAEAEA] bg-[#EAEAEA] text-sm dark:border-white/[0.08] dark:bg-white/[0.08] sm:grid-cols-2">
        <div className="bg-[#F9F9F8] p-5 dark:bg-[#1a1a1a]">
          <dt className="text-xs font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-[#A09C98]">
            Your referral code
          </dt>
          <dd className="mt-2 font-mono text-base font-semibold tracking-wide text-[#111111] dark:text-[#FAFAFA]">
            {code}
          </dd>
        </div>
        <div className="bg-[#F9F9F8] p-5 dark:bg-[#1a1a1a]">
          <dt className="text-xs font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-[#A09C98]">
            Bonus credits (balance)
          </dt>
          <dd className="mt-2 font-mono font-semibold tabular-nums text-[#111111] dark:text-[#FAFAFA]">
            {bonusBalance}
          </dd>
        </div>
        <div className="bg-[#F9F9F8] p-5 dark:bg-[#1a1a1a]">
          <dt className="text-xs font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-[#A09C98]">
            Friends attributed
          </dt>
          <dd className="mt-2 font-mono font-semibold tabular-nums text-[#111111] dark:text-[#FAFAFA]">
            {referredCount}
          </dd>
        </div>
        <div className="bg-[#F9F9F8] p-5 dark:bg-[#1a1a1a]">
          <dt className="text-xs font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-[#A09C98]">
            Successful referrals
          </dt>
          <dd className="mt-2 font-mono font-semibold tabular-nums text-[#111111] dark:text-[#FAFAFA]">
            {successfulReferralsCount}
          </dd>
        </div>
      </dl>

      {inProgressInvites > 0 && (
        <p className="mt-5 text-xs leading-[1.6] text-[#787774] dark:text-[#A09C98]">
          {inProgressInvites} invite{inProgressInvites !== 1 ? "s" : ""} still in progress (onboarding or qualifying
          interview).
        </p>
      )}

      <p className="mt-5 text-xs leading-[1.6] text-[#787774] dark:text-[#A09C98]">
        Status: <span className="font-medium text-[#111111] dark:text-[#E7E5E4]">Attributed</span> → signed up with your
        link; <span className="font-medium text-[#111111] dark:text-[#E7E5E4]">Qualified</span> → met requirements;
        rewards show as <span className="font-medium text-[#111111] dark:text-[#E7E5E4]">Successful</span> here once
        credits are granted.
      </p>

      <div className="mt-8 space-y-3">
        <label
          htmlFor="referral-link-readonly"
          className="text-xs font-medium uppercase tracking-[0.05em] text-[#787774] dark:text-[#A09C98]"
        >
          Referral link
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            id="referral-link-readonly"
            type="text"
            readOnly
            value={inviteUrl}
            className="min-h-11 min-w-0 flex-1 rounded-md border border-[#EAEAEA] bg-[#F9F9F8] px-3 py-3 font-mono text-sm leading-[1.6] text-[#111111] dark:border-white/[0.12] dark:bg-[#0c0c0c] dark:text-[#FAFAFA] sm:text-sm"
          />
          <Button
            variant="charcoal"
            size="md"
            className="min-h-11 shrink-0"
            onClick={copyLink}
            type="button"
          >
            <LinkSimple className="h-4 w-4 shrink-0" weight="bold" aria-hidden />
            {copied ? "Copied" : "Copy referral link"}
          </Button>
        </div>
        <Button
          variant="outline"
          size="md"
          className="min-h-11 rounded-md border-[#EAEAEA] bg-transparent text-[#111111] hover:bg-[#F7F6F3] dark:border-white/[0.12] dark:text-neutral-100 dark:hover:bg-white/[0.06]"
          onClick={copyCode}
          type="button"
        >
          <Copy className="h-4 w-4 shrink-0" weight="bold" aria-hidden />
          Copy code only
        </Button>
        {clipboardMessage ? (
          <p className="text-xs leading-[1.6] text-[#9F2F2D] dark:text-[#FCA5A5]" role="alert">
            {clipboardMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
