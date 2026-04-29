import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getRateLimitIdentifier, rateLimitForKind, tooManyRequestsResponse } from "@/lib/rate-limit";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { checkProfileAndCv } from "@/lib/profile-guard";
import { captureServer } from "@/lib/analytics-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
import { parseJsonBody } from "@/lib/api-validation";
import { jobApplicationSchema } from "@/types/schemas";
import { captureException } from "@/lib/monitoring";
import { computeAiRecommendationReason } from "@/lib/ai-recommendation-reason";
import { notifyEmployerNewApplication } from "@/lib/employer-notifications";

export async function POST(request: NextRequest) {
  logInfo("job-applications request received");
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const guard = await checkProfileAndCv(supabase, user.id);
    if (!guard.canApplyOrInterview) {
      const reasons: string[] = [];
      if (!guard.profileComplete) reasons.push("Complete required profile fields (name, email, location)");
      if (guard.profileComplete && !guard.hasCv) {
        reasons.push("Upload a CV in your profile or complete a CV analysis so we have your résumé on file");
      }
      return NextResponse.json(
        {
          error: "Complete your profile and add a CV (upload or CV analysis) before applying.",
          details: reasons,
        },
        { status: 403 }
      );
    }

    const rlId = getRateLimitIdentifier(request, user.id);
    const limited = await rateLimitForKind("jobApplications", rlId);
    if (!limited.success) return tooManyRequestsResponse(limited);

    const parsed = await parseJsonBody(request, jobApplicationSchema);
    if (!parsed.ok) {
      logWarn("job-applications validation failed", { reason: "body schema" });
      return parsed.response;
    }
    const { jobId } = parsed.data;

    const { data: job } = await supabase
      .from("job_listings")
      .select("id, title, min_cv_score, company_id")
      .eq("id", jobId)
      .eq("is_active", true)
      .maybeSingle();

    if (!job) {
      logWarn("job-applications job not found or inactive", { jobId });
      return NextResponse.json({ error: "Job not found or inactive" }, { status: 404 });
    }

    // Enforce employer application limit
    const companyId = (job as { company_id?: string }).company_id;
    if (companyId) {
      const { data: companyData } = await supabase
        .from("companies")
        .select("total_application_limit, stripe_subscription_status")
        .eq("id", companyId)
        .maybeSingle();

      const limit = (companyData as { total_application_limit?: number } | null)?.total_application_limit ?? 50;
      const isSubscribed = (companyData as { stripe_subscription_status?: string } | null)?.stripe_subscription_status === "active";

      if (isSubscribed) {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
          return NextResponse.json({ error: "Application limit check unavailable" }, { status: 503 });
        }
        const admin = createAdminClient();
        const { data: companyListings } = await admin
          .from("job_listings")
          .select("id")
          .eq("company_id", companyId);

        const listingIds = (companyListings ?? []).map((l: { id: string }) => l.id);

        if (listingIds.length > 0) {
          const { count } = await admin
            .from("job_applications")
            .select("id", { count: "exact", head: true })
            .in("job_id", listingIds);

          if ((count ?? 0) >= limit) {
            logWarn("job-applications employer application limit reached", { companyId, count, limit });
            return NextResponse.json(
              { error: "This employer has reached the maximum number of applications for their current plan. Please try again later." },
              { status: 403 }
            );
          }
        }
      }
    }

    const jobTitle = (job as { title?: string }).title ?? "";
    const minScore = (job as { min_cv_score: number | null }).min_cv_score ?? 0;

    const { data: latestCvByJob } = await supabase
      .from("cv_analyses")
      .select("overall_score")
      .eq("user_id", user.id)
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: latestCvByCategory } = latestCvByJob
      ? { data: null }
      : await supabase
          .from("cv_analyses")
          .select("overall_score")
          .eq("user_id", user.id)
          .eq("job_category", jobTitle)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
    const latestCv = latestCvByJob ?? latestCvByCategory;

    const cvScore = typeof (latestCv as { overall_score?: number } | null)?.overall_score === "number"
      ? (latestCv as { overall_score: number }).overall_score
      : null;

    if (cvScore === null || cvScore < minScore) {
      return NextResponse.json(
        {
          error:
            cvScore === null
              ? "Complete a CV analysis for this role before submitting an application."
              : `CV score ${cvScore} is below the job minimum (${minScore})`,
        },
        { status: 403 }
      );
    }

    const { data: latestInterviewByJob } = await supabase
      .from("mock_interviews")
      .select("score, report")
      .eq("user_id", user.id)
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: latestInterviewByCategory } = latestInterviewByJob
      ? { data: null }
      : await supabase
          .from("mock_interviews")
          .select("score, report")
          .eq("user_id", user.id)
          .eq("job_category", jobTitle)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
    const latestInterview = latestInterviewByJob ?? latestInterviewByCategory;

    if (!latestInterview) {
      return NextResponse.json(
        { error: "Complete a mock interview for this role before submitting an application." },
        { status: 403 }
      );
    }

    const interviewScore = typeof (latestInterview as { score: number | null }).score === "number"
      ? (latestInterview as { score: number }).score
      : null;
    const rawReport = (latestInterview as {
      report?: {
        strengths?: unknown[];
        improvements?: unknown[];
        technical_score?: number;
        communication_score?: number;
        problem_solving_score?: number;
        justification?: string;
        evaluation_meta?: { used_fallback?: boolean };
      };
    }).report ?? {};
    const interviewReport: {
      strengths: string[];
      improvements: string[];
      technical_score?: number;
      communication_score?: number;
      problem_solving_score?: number;
      justification?: string;
      evaluation_meta?: { used_fallback?: boolean };
    } = {
      strengths: Array.isArray(rawReport.strengths) ? rawReport.strengths.filter((s): s is string => typeof s === "string") : [],
      improvements: Array.isArray(rawReport.improvements) ? rawReport.improvements.filter((s): s is string => typeof s === "string") : [],
    };
    if (typeof rawReport.technical_score === "number") interviewReport.technical_score = rawReport.technical_score;
    if (typeof rawReport.communication_score === "number") interviewReport.communication_score = rawReport.communication_score;
    if (typeof rawReport.problem_solving_score === "number") interviewReport.problem_solving_score = rawReport.problem_solving_score;
    if (typeof rawReport.justification === "string" && rawReport.justification.trim())
      interviewReport.justification = rawReport.justification.trim();
    if (rawReport.evaluation_meta && typeof rawReport.evaluation_meta === "object")
      interviewReport.evaluation_meta = rawReport.evaluation_meta as { used_fallback?: boolean };

    const minCv = (job as { min_cv_score: number | null }).min_cv_score ?? 0;
    const ai_recommendation_reason = computeAiRecommendationReason({
      cvScore,
      interviewScore,
      technical: interviewReport.technical_score ?? null,
      communication: interviewReport.communication_score ?? null,
      problemSolving: interviewReport.problem_solving_score ?? null,
      minCvScore: minCv,
    });

    const { error } = await supabase.from("job_applications").upsert(
      {
        user_id: user.id,
        job_id: jobId,
        cv_score: cvScore,
        interview_score: interviewScore,
        interview_report: interviewReport,
        ai_recommendation_reason,
        status: "completed",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,job_id" }
    );

    if (error) {
      logError("job-applications upsert failed", error);
      captureException(error, {
        route: "/api/job-applications",
        user_id: user.id,
        job_id: jobId,
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await captureServer(user.id, ANALYTICS_EVENTS.application_completed, {
      job_id: jobId,
      cv_score: cvScore,
      interview_score: interviewScore,
    });

    if (companyId) {
      const { data: companyRow } = await supabase
        .from("companies")
        .select("user_id")
        .eq("id", companyId)
        .maybeSingle();
      const employerUserId = (companyRow as { user_id?: string } | null)?.user_id;
      if (employerUserId) {
        await captureServer(employerUserId, ANALYTICS_EVENTS.employer_received_application, {
          job_id: jobId,
          applicant_user_id: user.id,
        });
        notifyEmployerNewApplication({
          employerUserId,
          jobId,
          applicantUserId: user.id,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    logError("job-applications unexpected error", e);
    captureException(e, { route: "/api/job-applications" });
    return NextResponse.json({ error: "Failed to save application" }, { status: 500 });
  }
}
