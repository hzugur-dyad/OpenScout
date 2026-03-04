"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function JobApplyPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;
  const supabase = createClient();

  const [job, setJob] = useState<{
    id: string;
    title: string;
    min_cv_score: number | null;
    companies: { name: string } | null;
  } | null>(null);
  const [cvScore, setCvScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: jobData } = await supabase
        .from("job_listings")
        .select("id, title, min_cv_score, companies(name)")
        .eq("id", jobId)
        .single();
      setJob(jobData as typeof job);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: latestCv } = await supabase
        .from("cv_analyses")
        .select("overall_score")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      setCvScore(latestCv?.overall_score ?? null);
      setLoading(false);
    }
    load();
  }, [jobId, supabase]);

  if (loading || !job) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const minScore = job.min_cv_score ?? 0;
  const canProceed = cvScore !== null && cvScore >= minScore;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/jobs/${jobId}`} className="text-sm text-gray-500 hover:underline">
        ← Back to job
      </Link>
      <h1 className="mt-6 text-2xl font-bold">{job.title} - Application</h1>
      <p className="mt-1 text-gray-500">
        {(job.companies as { name: string })?.name || "Company"}
      </p>

      <div className="mt-8 rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-card">
        {!canProceed ? (
          <>
            <div className="flex items-start gap-3 text-amber-700">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <div>
                <h3 className="font-semibold">CV Score Too Low</h3>
                <p className="mt-1 text-sm">
                  Minimum CV score for this job is {minScore}. Your CV score:{" "}
                  {cvScore ?? "not yet analyzed"}.
                </p>
                <p className="mt-2 text-sm">
                  Complete a CV analysis to improve your score or finish your profile.
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-4">
              <Link href="/cv-analysis">
                <Button variant="primary">Run CV Analysis</Button>
              </Link>
              <Link href={`/jobs/${jobId}`}>
                <Button variant="outline">Go Back</Button>
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 text-green-700">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                OK
              </span>
              <div>
                <h3 className="font-semibold">You qualify for the interview</h3>
                <p className="text-sm">
                  Your CV score ({cvScore}) meets the minimum requirement ({minScore}).
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              className="mt-6"
              onClick={() =>
                router.push(
                  `/mock-interview/${crypto.randomUUID()}?category=${encodeURIComponent(job.title)}&jobId=${jobId}`
                )
              }
            >
              Start AI Interview
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
