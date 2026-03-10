"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { JOB_TITLES } from "@/constants/jobFormOptions";
import { UsageBanner } from "@/components/dashboard/UsageBanner";
import { createClient } from "@/lib/supabase/client";

export default function MockInterviewPage() {
  const [jobCategory, setJobCategory] = useState<string>(JOB_TITLES[0]);
  const [showMicTest, setShowMicTest] = useState(false);
  const [guard, setGuard] = useState<{ profileComplete: boolean; hasCv: boolean; canApplyOrInterview: boolean; missingProfileFields: string[] } | null>(null);
  const [guardLoading, setGuardLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadGuard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setGuardLoading(false);
        return;
      }
      const [profileRes, cvRes] = await Promise.all([
        supabase.from("profiles").select("first_name, last_name, email, location").eq("user_id", user.id).maybeSingle(),
        supabase.from("cv_analyses").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
      ]);
      const profile = profileRes.data as { first_name?: string; last_name?: string; email?: string; location?: string } | null;
      const required = ["first_name", "last_name", "email", "location"] as const;
      const missingProfileFields: string[] = [];
      for (const field of required) {
        const v = profile?.[field];
        if (v === undefined || v === null || String(v).trim() === "") {
          missingProfileFields.push(field === "first_name" ? "First name" : field === "last_name" ? "Last name" : field === "email" ? "Email" : "Location");
        }
      }
      const profileComplete = missingProfileFields.length === 0;
      const hasCv = cvRes.data != null;
      setGuard({ profileComplete, hasCv, canApplyOrInterview: profileComplete && hasCv, missingProfileFields });
      setGuardLoading(false);
    }
    loadGuard();
  }, [supabase]);

  function handleStart() {
    const id = crypto.randomUUID();
    router.push(`/mock-interview/${id}?category=${encodeURIComponent(jobCategory)}`);
  }

  const showGate = guard && !guard.canApplyOrInterview;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">AI Mock Interview</h1>
      <p className="mt-1 text-gray-500">
        Select job category and practice with AI.
      </p>

      <UsageBanner feature="mock_interview" />

      {guardLoading ? (
        <div className="mt-8 flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : showGate ? (
        <div className="mt-8 rounded-[10px] border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3 text-amber-800">
            <AlertCircle className="h-6 w-6 shrink-0" />
            <div>
              <h3 className="font-semibold">Profile and CV required</h3>
              <p className="mt-1 text-sm">
                Complete your profile (name, email, location) and run at least one CV analysis before starting a mock interview.
              </p>
              {guard.missingProfileFields.length > 0 && (
                <p className="mt-2 text-sm">Missing: {guard.missingProfileFields.join(", ")}.</p>
              )}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link href="/onboarding">
              <Button variant="primary">Complete profile</Button>
            </Link>
            <Link href="/cv-analysis">
              <Button variant="outline">Run CV analysis</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium">Job Category</label>
            <select
              value={jobCategory}
              onChange={(e) => setJobCategory(e.target.value)}
              className="w-full rounded-[10px] border border-[var(--border)] px-4 py-3"
            >
              {JOB_TITLES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">What to Expect</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-zinc-400">
              <li>• ~20 minute conversation-style interview</li>
              <li>• Questions about your background and career goals</li>
              <li>• Role-specific technical questions</li>
              <li>• Session is recorded and a report is generated</li>
            </ul>
          </div>

          <div className="flex gap-4">
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleStart}
              icon={MessageCircle}
            >
              Start Interview
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
