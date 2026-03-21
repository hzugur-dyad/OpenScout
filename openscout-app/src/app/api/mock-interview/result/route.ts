import { NextRequest, NextResponse } from "next/server";
import { getGroq } from "@/lib/groq";
import { createClient } from "@/lib/supabase/server";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { canUseFeature, logUsage, getUserPlan } from "@/lib/usage";
import { checkProfileAndCv } from "@/lib/profile-guard";
import { parseInterviewLocale, type InterviewLocale } from "@/lib/interview-locale";
import { captureServer } from "@/lib/analytics-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
import {
  REFERRAL_QUALIFYING_TRANSCRIPT_MIN_CHARS,
  tryCompleteReferralRewardForUser,
} from "@/lib/referral-rewards";
import { getRateLimitIdentifier, rateLimitForKind, tooManyRequestsResponse } from "@/lib/rate-limit";
import { buildInterviewEvaluationSystemPrompt, GROQ_JSON_OBJECT_RESPONSE_FORMAT } from "@/lib/ai/prompts";
import { parseInterviewEvaluationModelOutput } from "@/lib/ai/structured-output";
import { GROQ_MOCK_INTERVIEW_MODEL, MOCK_INTERVIEW_PIPELINE_VERSION } from "@/lib/mock-interview/versioning";
import { captureException, captureMessage } from "@/lib/monitoring";

export async function POST(request: NextRequest) {
  logInfo("mock-interview result request received");
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rlId = getRateLimitIdentifier(request, user.id);
    const limited = await rateLimitForKind("interviewResult", rlId);
    if (!limited.success) return tooManyRequestsResponse(limited);

    const guard = await checkProfileAndCv(supabase, user.id);
    if (!guard.canApplyOrInterview) {
      return NextResponse.json(
        { error: "Complete your profile and run a CV analysis before submitting interview results." },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid JSON body",
          message: "Request body must be valid JSON",
        },
        { status: 400 }
      );
    }

    const { transcript, jobCategory, jobId, interviewLanguage } = (body ?? {}) as {
      transcript?: unknown;
      jobCategory?: unknown;
      jobId?: unknown;
      interviewLanguage?: unknown;
    };
    const locale: InterviewLocale = parseInterviewLocale(
      typeof interviewLanguage === "string" ? interviewLanguage : undefined
    );
    if (!transcript) {
      logWarn("mock-interview result validation failed", { reason: "transcript required" });
      return NextResponse.json(
        { error: "transcript required" },
        { status: 400 }
      );
    }

    const transcriptStr = typeof transcript === "string" ? transcript : "";
    if (transcriptStr.trim().length < REFERRAL_QUALIFYING_TRANSCRIPT_MIN_CHARS) {
      logWarn("mock-interview result validation failed", { reason: "transcript too short" });
      return NextResponse.json(
        { error: "Interview transcript too short to evaluate." },
        { status: 400 }
      );
    }

    const groq = getGroq();
    const evalSystem = buildInterviewEvaluationSystemPrompt(
      typeof jobCategory === "string" ? jobCategory : "the role",
      locale
    );

    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: GROQ_MOCK_INTERVIEW_MODEL,
        temperature: 0.2,
        response_format: GROQ_JSON_OBJECT_RESPONSE_FORMAT,
        messages: [
          {
            role: "system",
            content: evalSystem,
          },
          {
            role: "user",
            content: transcriptStr,
          },
        ],
      });
    } catch (groqError) {
      logError("mock-interview result Groq request failed", groqError);
      captureException(groqError, {
        route: "/api/mock-interview/result",
        user_id: user.id,
        ...(jobId && typeof jobId === "string" && jobId.trim() ? { job_id: jobId.trim() } : {}),
        aiInterview: { stage: "evaluation", reason: "groq_error" },
      });
      return NextResponse.json(
        { error: groqError instanceof Error ? groqError.message : "Evaluation error" },
        { status: 500 }
      );
    }

    const text = completion.choices[0]?.message?.content ?? "";
    if (!text.trim()) {
      logWarn("mock-interview result Groq returned empty content — using fallback evaluation");
      captureMessage("Mock interview result: empty model output, fallback evaluation", {
        route: "/api/mock-interview/result",
        user_id: user.id,
        ...(jobId && typeof jobId === "string" && jobId.trim() ? { job_id: jobId.trim() } : {}),
        aiInterview: { stage: "evaluation", reason: "empty_model" },
      });
    }

    const normalized = parseInterviewEvaluationModelOutput(text.trim() ? text : "");
    if (normalized.usedFallback) {
      logWarn("mock-interview result: parser used fallback scores", { jobCategory });
      captureMessage("Mock interview result: fallback scoring used", {
        route: "/api/mock-interview/result",
        user_id: user.id,
        ...(jobId && typeof jobId === "string" && jobId.trim() ? { job_id: jobId.trim() } : {}),
        aiInterview: { stage: "evaluation", reason: "fallback_scoring_used" },
      });
    }

    const overallScore = normalized.overallScore;
    const technicalScore = normalized.technicalScore;
    const communicationScore = normalized.communicationScore;
    const problemSolvingScore = normalized.problemSolvingScore;
    const strengths = normalized.strengths;
    const improvements = normalized.improvements;
    const justification = normalized.justification;

    const report: {
      strengths: string[];
      improvements: string[];
      justification?: string;
      technical_score?: number;
      communication_score?: number;
      problem_solving_score?: number;
    } = { strengths, improvements };
    if (justification) report.justification = justification;
    if (technicalScore !== null) report.technical_score = technicalScore;
    if (communicationScore !== null) report.communication_score = communicationScore;
    if (problemSolvingScore !== null) report.problem_solving_score = problemSolvingScore;

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, bonus_mock_interview_credits")
      .eq("user_id", user.id)
      .maybeSingle();
    const plan = getUserPlan(profile?.plan);
    const bonusCredits = Math.max(0, Number(profile?.bonus_mock_interview_credits) || 0);
    const { allowed, used, limit, viaBonus } = await canUseFeature(
      supabase,
      user.id,
      "mock_interview",
      plan,
      bonusCredits
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Weekly mock interview limit reached. Upgrade your plan for more.", used, limit },
        { status: 403 }
      );
    }

    if (!jobCategory) {
      logWarn("mock-interview result validation failed", { reason: "jobCategory required" });
      return NextResponse.json({ error: "jobCategory required" }, { status: 400 });
    }

    const { error: insertError } = await supabase.from("mock_interviews").insert({
      user_id: user.id,
      job_category: jobCategory,
      ...(jobId && typeof jobId === "string" && jobId.trim() ? { job_id: jobId.trim() } : {}),
      score: overallScore,
      report,
      transcript: transcriptStr,
      interview_language: locale,
      model_version: GROQ_MOCK_INTERVIEW_MODEL,
      prompt_version: MOCK_INTERVIEW_PIPELINE_VERSION,
    });

    if (insertError) {
      logError("mock-interview result insert failed", insertError);
      captureException(insertError, {
        route: "/api/mock-interview/result",
        user_id: user.id,
        ...(jobId && typeof jobId === "string" && jobId.trim() ? { job_id: jobId.trim() } : {}),
      });
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    if (viaBonus) {
      const nextBonus = Math.max(0, bonusCredits - 1);
      const { error: bonusErr } = await supabase
        .from("profiles")
        .update({ bonus_mock_interview_credits: nextBonus })
        .eq("user_id", user.id);
      if (bonusErr) {
        logError("mock-interview bonus credit decrement failed", bonusErr);
      }
    } else {
      await logUsage(supabase, user.id, "mock_interview");
    }

    await tryCompleteReferralRewardForUser(user.id);

    await captureServer(user.id, ANALYTICS_EVENTS.interview_completed, {
      job_category: jobCategory,
      score: overallScore,
      ...(jobId && typeof jobId === "string" && jobId.trim() ? { job_id: jobId.trim() } : {}),
    });

    const responsePayload = {
      score: overallScore,
      overall_score: overallScore,
      strengths,
      improvements,
      ...(justification && { justification }),
      ...(technicalScore !== null && { technical_score: technicalScore }),
      ...(communicationScore !== null && { communication_score: communicationScore }),
      ...(problemSolvingScore !== null && { problem_solving_score: problemSolvingScore }),
    };
    return NextResponse.json(responsePayload);
  } catch (e) {
    logError("mock-interview result unexpected error", e);
    captureException(e, { route: "/api/mock-interview/result" });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Evaluation error" },
      { status: 500 }
    );
  }
}
