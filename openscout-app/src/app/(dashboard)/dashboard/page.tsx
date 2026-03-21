"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, MessageCircle, Briefcase, ArrowRight, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardInteractive } from "@/components/ui/Card";
import { InviteFriendCard } from "@/components/dashboard/InviteFriendCard";
import { NextStepCard } from "@/components/dashboard/NextStepCard";
import { SharePublicProfileButton } from "@/components/dashboard/SharePublicProfileButton";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserPlan, PLAN_LIMITS, type CandidatePlan } from "@/lib/usage";
import { applyPendingCandidateProfileIfAny } from "@/lib/apply-pending-registration-profile";
import { buildJourneySignals, deriveDashboardNextStep, type NextStepCardModel } from "@/lib/next-step-guidance";

const PENDING_EMPLOYER_KEY = "pending_employer_company";

export default function DashboardPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<CandidatePlan>("free");
  const [cvUsed, setCvUsed] = useState(0);
  const [mockUsed, setMockUsed] = useState(0);
  const [mockBonusCredits, setMockBonusCredits] = useState(0);
  const [checkedEmployer, setCheckedEmployer] = useState(false);
  const [nextStep, setNextStep] = useState<NextStepCardModel | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let pendingEmployer = false;
      try {
        pendingEmployer = !!sessionStorage.getItem(PENDING_EMPLOYER_KEY);
      } catch {}
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      const isEmployer = profile?.role === "employer" || company != null || pendingEmployer;
      if (isEmployer) {
        router.replace("/employer");
        return;
      }
      try {
        await applyPendingCandidateProfileIfAny(supabase, user.id, user.email ?? undefined);
      } catch (_) {}
      setCheckedEmployer(true);
    }
    load();
  }, [supabase, router]);

  useEffect(() => {
    if (!checkedEmployer) return;
    async function loadPlan() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, bonus_mock_interview_credits")
        .eq("user_id", user.id)
        .maybeSingle();
      const p = getUserPlan(profile?.plan);
      setPlan(p);
      setMockBonusCredits(
        Math.max(0, Number((profile as { bonus_mock_interview_credits?: number } | null)?.bonus_mock_interview_credits) || 0)
      );

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { count: cv } = await supabase
        .from("usage_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("feature", "cv_analysis")
        .gte("created_at", weekAgo.toISOString());
      const { count: mock } = await supabase
        .from("usage_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("feature", "mock_interview")
        .gte("created_at", weekAgo.toISOString());
      setCvUsed(cv ?? 0);
      setMockUsed(mock ?? 0);
    }
    loadPlan();
  }, [supabase, checkedEmployer]);

  useEffect(() => {
    if (!checkedEmployer) return;
    async function loadJourney() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [profileRes, privRes, cvRes, miRes, jaRes] = await Promise.all([
        supabase.from("profiles").select("onboarding_completed_at").eq("user_id", user.id).maybeSingle(),
        supabase.from("profile_private").select("cv_file_url, cv_raw_text").eq("user_id", user.id).maybeSingle(),
        supabase.from("cv_analyses").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
        supabase.from("mock_interviews").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
        supabase.from("job_applications").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
      ]);
      const priv = privRes.data as { cv_file_url?: string | null; cv_raw_text?: string | null } | null;
      const signals = buildJourneySignals({
        onboardingCompletedAt: (profileRes.data as { onboarding_completed_at?: string | null } | null)?.onboarding_completed_at,
        cvFileUrl: priv?.cv_file_url,
        cvRawText: priv?.cv_raw_text,
        cvAnalysisRowExists: cvRes.data != null,
        mockInterviewRowExists: miRes.data != null,
        jobApplicationRowExists: jaRes.data != null,
      });
      setNextStep(deriveDashboardNextStep(signals));
    }
    loadJourney();
  }, [supabase, checkedEmployer]);

  const cvLimit = PLAN_LIMITS[plan].cv_analysis;
  const mockLimit = PLAN_LIMITS[plan].mock_interview;

  if (!checkedEmployer) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Welcome</h1>
      <p className="mt-1 text-gray-500 dark:text-zinc-400">
        Use <span className="font-medium text-gray-700 dark:text-zinc-300">My profile</span> to finish setup, then CV analysis and mock interviews.
      </p>

      <div className="mt-4">
        <SharePublicProfileButton />
      </div>

      <Card className="mt-4 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-zinc-300">
            <span className="font-semibold capitalize">{plan}</span> plan
            {" — "}
            CV: {cvUsed}/{cvLimit === Infinity ? "∞" : cvLimit}
            {" · "}
            Interview: {mockUsed}/{mockLimit === Infinity ? "∞" : mockLimit}
            {" this week"}
            {mockBonusCredits > 0 && (
              <span className="text-gray-500 dark:text-zinc-500">
                {" "}
                · {mockBonusCredits} bonus credit{mockBonusCredits !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {plan === "free" && (
            <Link href="/pricing">
              <Button variant="outline" size="sm" icon={CreditCard} iconPosition="left">
                Upgrade
              </Button>
            </Link>
          )}
        </div>
      </Card>

      {nextStep && <NextStepCard step={nextStep} />}

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/onboarding">
          <CardInteractive className="p-6">
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--primary-muted)" }}
            >
              <FileText className="h-6 w-6" style={{ color: "var(--primary-dark)" }} />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">My profile</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
              Finish or update your details in one place
            </p>
            <div className="mt-4 flex items-center text-sm font-medium" style={{ color: "var(--primary)" }}>
              Start <ArrowRight className="ml-1 h-4 w-4" />
            </div>
          </CardInteractive>
        </Link>

        <Link href="/cv-analysis">
          <CardInteractive className="p-6">
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--primary-muted)" }}
            >
              <FileText className="h-6 w-6" style={{ color: "var(--primary-dark)" }} />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">CV Analysis</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
              Get your CV evaluated by AI
            </p>
            <div className="mt-4 flex items-center text-sm font-medium" style={{ color: "var(--primary)" }}>
              Start <ArrowRight className="ml-1 h-4 w-4" />
            </div>
          </CardInteractive>
        </Link>

        <Link href="/mock-interview">
          <CardInteractive className="p-6">
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--primary-muted)" }}
            >
              <MessageCircle className="h-6 w-6" style={{ color: "var(--primary-dark)" }} />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Mock Interview</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
              Practice with AI
            </p>
            <div className="mt-4 flex items-center text-sm font-medium" style={{ color: "var(--primary)" }}>
              Start <ArrowRight className="ml-1 h-4 w-4" />
            </div>
          </CardInteractive>
        </Link>

        <Link href="/dashboard/jobs" className="sm:col-span-2 lg:col-span-3">
          <CardInteractive className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--primary-muted)" }}
                >
                  <Briefcase className="h-6 w-6" style={{ color: "var(--primary-dark)" }} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Job Listings</h3>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">
                    Apply to open positions
                  </p>
                </div>
              </div>
              <Button variant="primary" size="sm">
                View Listings
              </Button>
            </div>
          </CardInteractive>
        </Link>

        <div className="sm:col-span-2 lg:col-span-3">
          <InviteFriendCard />
        </div>
      </div>
    </div>
  );
}
