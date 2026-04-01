import { NextRequest, NextResponse } from "next/server";
import { parseInterviewLocale, type InterviewLocale } from "@/lib/interview-locale";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { captureException } from "@/lib/monitoring";
import { checkProfileAndCv } from "@/lib/profile-guard";
import {
  getRateLimitIdentifier,
  isRateLimitBypassed,
  rateLimitForKind,
  tooManyRequestsResponse,
} from "@/lib/rate-limit";
import {
  REFERRAL_QUALIFYING_TRANSCRIPT_MIN_CHARS,
  tryCompleteReferralRewardForUser,
} from "@/lib/referral-rewards";
import { createClient } from "@/lib/supabase/server";
import { captureServer } from "@/lib/analytics-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
import { assessInterviewTranscriptQuality } from "@/lib/mock-interview/transcript-quality";
import { MOCK_INTERVIEW_POLICY_VERSION } from "@/lib/mock-interview/policy";
import {
  GROQ_MOCK_INTERVIEW_THINKING_MODEL,
  GROQ_MOCK_INTERVIEW_SCORING_MODEL,
  MOCK_INTERVIEW_PIPELINE_VERSION,
} from "@/lib/mock-interview/versioning";
import { canUseFeature, getUserPlan, logUsage } from "@/lib/usage";
import { generateInterviewScorecard } from "@/services/ai";
import type { InterviewJobContext, InterviewTranscriptEntry } from "@/services/interview";

const SESSION_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseTranscriptEntries(transcript: string): InterviewTranscriptEntry[] {
  return transcript
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(assistant|user):\s*(.*)$/i);
      if (!match) {
        return { role: "assistant" as const, content: line };
      }
      return {
        role: match[1].toLowerCase() === "user" ? ("user" as const) : ("assistant" as const),
        content: match[2] ?? "",
      };
    });
}

function normalizeJobContext(
  jobCategory: string,
  row: {
    title?: string | null;
    description?: string | null;
    requirements?: string | null;
    ai_interview_config?: unknown;
  } | null
): InterviewJobContext {
  const config = (row?.ai_interview_config as { custom_questions?: unknown } | null) ?? null;
  const customQuestions = Array.isArray(config?.custom_questions)
    ? config.custom_questions.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];

  return {
    role: row?.title?.trim() || jobCategory,
    description: row?.description?.trim() || "",
    requirements: row?.requirements?.trim() || "",
    customQuestions,
  };
}

export async function POST(request: NextRequest) {
  logInfo("mock-interview result request received");

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isRateLimitBypassed(user)) {
      const rlId = getRateLimitIdentifier(request, user.id);
      const limited = await rateLimitForKind("interviewResult", rlId);
      if (!limited.success) return tooManyRequestsResponse(limited);
    }

    const guard = await checkProfileAndCv(supabase, user.id);
    if (!guard.canApplyOrInterview) {
      return NextResponse.json(
        {
          error:
            "Complete your profile and add a CV (upload or CV analysis) before submitting interview results.",
        },
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

    const b = body as {
      transcript?: unknown;
      jobCategory?: unknown;
      jobId?: unknown;
      interviewLanguage?: unknown;
      sessionId?: unknown;
      durationMs?: unknown;
    };

    const sessionIdRaw = typeof b.sessionId === "string" ? b.sessionId.trim() : "";
    if (!SESSION_UUID_RE.test(sessionIdRaw)) {
      logWarn("mock-interview result validation failed", { reason: "sessionId" });
      return NextResponse.json({ error: "sessionId must be a valid interview session UUID" }, { status: 400 });
    }

    const transcriptStr = typeof b.transcript === "string" ? b.transcript : "";
    if (!transcriptStr.trim()) {
      logWarn("mock-interview result validation failed", { reason: "transcript required" });
      return NextResponse.json({ error: "transcript required" }, { status: 400 });
    }

    if (transcriptStr.trim().length < REFERRAL_QUALIFYING_TRANSCRIPT_MIN_CHARS) {
      logWarn("mock-interview result validation failed", { reason: "transcript too short" });
      return NextResponse.json(
        { error: "Interview transcript too short to evaluate." },
        { status: 400 }
      );
    }

    const jobCategory = typeof b.jobCategory === "string" ? b.jobCategory.trim() : "";
    if (!jobCategory) {
      logWarn("mock-interview result validation failed", { reason: "jobCategory required" });
      return NextResponse.json({ error: "jobCategory required" }, { status: 400 });
    }

    const jobId = typeof b.jobId === "string" && b.jobId.trim() ? b.jobId.trim() : undefined;
    const interviewLocale: InterviewLocale = parseInterviewLocale(
      typeof b.interviewLanguage === "string" ? b.interviewLanguage : undefined
    );
    const scoringLocale: InterviewLocale = "en";

    let durationMs: number | null = null;
    if (typeof b.durationMs === "number" && !Number.isNaN(b.durationMs) && b.durationMs >= 0) {
      durationMs = Math.min(Math.round(b.durationMs), 6 * 60 * 60 * 1000);
    }

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

    let jobContext: InterviewJobContext = {
      role: jobCategory,
      description: "",
      requirements: "",
      customQuestions: [],
    };

    if (jobId) {
      const { data: jobRow } = await supabase
        .from("job_listings")
        .select("title, description, requirements, ai_interview_config")
        .eq("id", jobId)
        .maybeSingle();

      jobContext = normalizeJobContext(jobCategory, jobRow as {
        title?: string | null;
        description?: string | null;
        requirements?: string | null;
        ai_interview_config?: unknown;
      } | null);
    }

    const transcriptQuality = assessInterviewTranscriptQuality(transcriptStr);
    const transcriptEntries = parseTranscriptEntries(transcriptStr);

    let scorecard;
    try {
      scorecard = await generateInterviewScorecard({
        locale: scoringLocale,
        transcript: transcriptEntries,
        jobContext,
      });
    } catch (groqError) {
      logError("mock-interview result Groq request failed", groqError);
      captureException(groqError, {
        route: "/api/mock-interview/result",
        user_id: user.id,
        ...(jobId ? { job_id: jobId } : {}),
        aiInterview: { stage: "evaluation", reason: "groq_error" },
      });
      return NextResponse.json(
        {
          error: groqError instanceof Error ? groqError.message : "Evaluation error",
          retryable: true,
          code: "evaluation_provider_error",
        },
        { status: 503 }
      );
    }

    let overallScore = scorecard.score;
    if (transcriptQuality.scoreCap != null && overallScore > transcriptQuality.scoreCap) {
      overallScore = transcriptQuality.scoreCap;
    }

    const report: {
      strengths: string[];
      improvements: string[];
      weaknesses: string[];
      verdict: string;
      summary?: string;
      justification?: string;
      technical_score?: number;
      communication_score?: number;
      problem_solving_score?: number;
      role_fit_score?: number;
      evidence_quality?: "low" | "medium" | "high";
      evaluation_meta: {
        used_fallback: boolean;
        transcript_signal: "low" | "normal";
        transcript_score_cap?: number;
        source: string;
        pipeline_version: string;
        planner_model: string;
        scoring_model: string;
        policy_version: string;
        evidence_quality: "low" | "medium" | "high";
      };
    } = {
      strengths: scorecard.strengths,
      improvements: scorecard.weaknesses,
      weaknesses: scorecard.weaknesses,
      verdict: scorecard.verdict,
      evaluation_meta: {
        used_fallback: scorecard.usedFallback,
        transcript_signal: transcriptQuality.isLowSignal ? "low" : "normal",
        ...(transcriptQuality.scoreCap != null ? { transcript_score_cap: transcriptQuality.scoreCap } : {}),
        source: "post_interview_evaluation",
        pipeline_version: MOCK_INTERVIEW_PIPELINE_VERSION,
        planner_model: GROQ_MOCK_INTERVIEW_THINKING_MODEL,
        scoring_model: GROQ_MOCK_INTERVIEW_SCORING_MODEL,
        policy_version: MOCK_INTERVIEW_POLICY_VERSION,
        evidence_quality: scorecard.evidenceQuality,
      },
    };

    if (scorecard.summary) {
      report.summary = scorecard.summary;
      report.justification = scorecard.summary;
    }

    report.technical_score = scorecard.technical;
    report.communication_score = scorecard.communication;
    if (scorecard.problemSolving !== null) {
      report.problem_solving_score = scorecard.problemSolving;
    }
    report.role_fit_score = scorecard.roleFit;
    report.evidence_quality = scorecard.evidenceQuality;

    const upsertRow: Record<string, unknown> = {
      id: sessionIdRaw,
      user_id: user.id,
      job_category: jobCategory,
      score: overallScore,
      report,
      transcript: transcriptStr,
      interview_language: interviewLocale,
      model_version: GROQ_MOCK_INTERVIEW_SCORING_MODEL,
      prompt_version: MOCK_INTERVIEW_PIPELINE_VERSION,
    };
    if (jobId) upsertRow.job_id = jobId;
    if (durationMs !== null) upsertRow.duration_ms = durationMs;

    const { error: upsertError } = await supabase.from("mock_interviews").upsert(upsertRow, { onConflict: "id" });
    if (upsertError) {
      logError("mock-interview result upsert failed", upsertError);
      captureException(upsertError, {
        route: "/api/mock-interview/result",
        user_id: user.id,
        ...(jobId ? { job_id: jobId } : {}),
      });
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
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
      verdict: scorecard.verdict,
      ...(jobId ? { job_id: jobId } : {}),
    });

    return NextResponse.json({
      interview_id: sessionIdRaw,
      score: overallScore,
      overall_score: overallScore,
      verdict: scorecard.verdict,
      summary: scorecard.summary,
      strengths: scorecard.strengths,
      improvements: scorecard.weaknesses,
      evaluation_used_fallback: scorecard.usedFallback,
      technical_score: scorecard.technical,
      communication_score: scorecard.communication,
      ...(scorecard.problemSolving !== null && { problem_solving_score: scorecard.problemSolving }),
    });
  } catch (error) {
    logError("mock-interview result unexpected error", error);
    captureException(error, { route: "/api/mock-interview/result" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Evaluation error" },
      { status: 500 }
    );
  }
}
