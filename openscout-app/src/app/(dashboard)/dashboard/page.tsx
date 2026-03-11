"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, MessageCircle, Briefcase, ArrowRight, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardInteractive } from "@/components/ui/Card";
import { InviteFriendCard } from "@/components/dashboard/InviteFriendCard";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserPlan, PLAN_LIMITS, type CandidatePlan } from "@/lib/usage";

const PENDING_EMPLOYER_KEY = "pending_employer_company";
const PENDING_PROFILE_KEY = "pending_candidate_profile";

export default function DashboardPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<CandidatePlan>("free");
  const [cvUsed, setCvUsed] = useState(0);
  const [mockUsed, setMockUsed] = useState(0);
  const [checkedEmployer, setCheckedEmployer] = useState(false);
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
        const raw = sessionStorage.getItem(PENDING_PROFILE_KEY);
        if (raw && user) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          if (parsed.first_name || parsed.last_name || parsed.location) {
            await supabase.from("profiles").upsert({
              user_id: user.id,
              first_name: (parsed.first_name as string) ?? "",
              last_name: (parsed.last_name as string) ?? "",
              email: user.email ?? "",
              location: (parsed.location as string) ?? "",
              professional_summary: (parsed.professional_summary as string) ?? "",
              updated_at: new Date().toISOString(),
            });

            const we = parsed.work_experiences as Array<Record<string, unknown>> | undefined;
            if (we && we.length > 0) {
              await supabase.from("work_experiences").delete().eq("user_id", user.id);
              for (let i = 0; i < we.length; i++) {
                await supabase.from("work_experiences").insert({
                  user_id: user.id, company_name: we[i].company_name, job_title: we[i].job_title,
                  start_date: we[i].start_date || null, end_date: we[i].end_date || null,
                  employment_type: we[i].employment_type || null, location: we[i].location || null,
                  is_remote: we[i].is_remote ?? false, description: we[i].description || null,
                  highlights: (we[i].highlights as string[]) || [], sort_order: i,
                });
              }
            }

            const eds = parsed.educations as Array<Record<string, unknown>> | undefined;
            if (eds && eds.length > 0) {
              await supabase.from("educations").delete().eq("user_id", user.id);
              for (let i = 0; i < eds.length; i++) {
                await supabase.from("educations").insert({
                  user_id: user.id, institution: eds[i].institution, location: eds[i].location || null,
                  degree_type: eds[i].degree_type || null, field_of_study: eds[i].field_of_study || null,
                  start_year: eds[i].start_year ? parseInt(eds[i].start_year as string) : null,
                  end_year: eds[i].end_year ? parseInt(eds[i].end_year as string) : null,
                  completed: eds[i].completed ?? true, sort_order: i,
                });
              }
            }

            if (parsed.job_search_status || parsed.available_start || parsed.domain) {
              await supabase.from("job_preferences").upsert({
                user_id: user.id,
                job_search_status: (parsed.job_search_status as string) || "actively_looking",
                available_start: (parsed.available_start as string) || "within_1_month",
                domain: (parsed.domain as string) || "engineering",
                updated_at: new Date().toISOString(),
              });
            }

            if (parsed.linkedin || parsed.github || parsed.portfolio) {
              await supabase.from("professional_links").upsert({
                user_id: user.id,
                linkedin: (parsed.linkedin as string) || null,
                github: (parsed.github as string) || null,
                portfolio: (parsed.portfolio as string) || null,
                updated_at: new Date().toISOString(),
              });
            }

            sessionStorage.removeItem(PENDING_PROFILE_KEY);
          }
        }
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
        .select("plan")
        .eq("user_id", user.id)
        .maybeSingle();
      const p = getUserPlan(profile?.plan);
      setPlan(p);

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
        Complete your profile and take an AI interview.
      </p>

      <Card className="mt-4 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-zinc-300">
            <span className="font-semibold capitalize">{plan}</span> plan
            {" — "}
            CV: {cvUsed}/{cvLimit === Infinity ? "∞" : cvLimit}
            {" · "}
            Interview: {mockUsed}/{mockLimit === Infinity ? "∞" : mockLimit}
            {" this week"}
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

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/onboarding">
          <CardInteractive className="p-6">
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--primary-muted)" }}
            >
              <FileText className="h-6 w-6" style={{ color: "var(--primary-dark)" }} />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">Complete Your Profile</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
              Your profile in 5 steps
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
