import { NextRequest, NextResponse } from "next/server";
import { getGroq } from "@/lib/groq";
import { createClient } from "@/lib/supabase/server";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { canUseFeature, logUsage, getUserPlan } from "@/lib/usage";
import { checkProfileAndCv } from "@/lib/profile-guard";
import { parseInterviewLocale, type InterviewLocale } from "@/lib/interview-locale";
import { captureServer } from "@/lib/analytics-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
import { tryCompleteReferralRewardForUser } from "@/lib/referral-rewards";
import {
  getRateLimitIdentifier,
  isRateLimitBypassed,
  rateLimitForKind,
  tooManyRequestsResponse,
} from "@/lib/rate-limit";
import {
  buildRecruiterGradeInterviewEvaluationSystemPrompt,
  GROQ_JSON_OBJECT_RESPONSE_FORMAT,
} from "@/lib/ai/prompts";
import { parseInterviewEvaluationModelOutput } from "@/lib/ai/structured-output";
import { GROQ_MOCK_INTERVIEW_MODEL, MOCK_INTERVIEW_PIPELINE_VERSION } from "@/lib/mock-interview/versioning";
import { assessInterviewTranscriptQuality } from "@/lib/mock-interview/transcript-quality";
import { captureException, captureMessage } from "@/lib/monitoring";

const SESSION_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildEmployerEvalRubricBlock(jobRow: { ai_interview_config?: unknown } | null): string {
  const config = jobRow?.ai_interview_config as { custom_questions?: unknown } | undefined;
  const qs = Array.isArray(config?.custom_questions)
    ? config.custom_questions.filter((q): q is string => typeof q === "string" && q.trim().length > 0)
    : [];
  if (qs.length === 0) return "";
  return qs.map((q, i) => `${i + 1}. ${q.trim()}`).join("\n");
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

    const jobCategory = typeof b.jobCategory === "string" ? b.jobCategory.trim() : "";
    if (!jobCategory) {
      logWarn("mock-interview result validation failed", { reason: "jobCategory required" });
      return NextResponse.json({ error: "jobCategory required" }, { status: 400 });
    }

    const jobId = typeof b.jobId === "string" && b.jobId.trim() ? b.jobId.trim() : undefined;
    const locale: InterviewLocale = parseInterviewLocale(
      typeof b.interviewLanguage === "string" ? b.interviewLanguage : undefined
    );

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

    let rubricBlock = "";
    if (jobId) {
      const { data: jobRow } = await supabase
        .from("job_listings")
        .select("ai_interview_config")
        .eq("id", jobId)
        .maybeSingle();
      rubricBlock = buildEmployerEvalRubricBlock(jobRow as { ai_interview_config?: unknown } | null);
    }

    const evalSystem = buildRecruiterGradeInterviewEvaluationSystemPrompt(jobCategory, locale, rubricBlock);

    const transcriptQuality = assessInterviewTranscriptQuality(transcriptStr);
    const lowSignalEvalNote =
      locale === "tr"
        ? `\n\n[DEĞERLENDİRME_NOTU: Transkriptte çok sayıda sessizlik/zaman aşımı satırı veya aşırı kısa aday yanıtları olabilir. Genel puanı yapay olarak yükseltme; güçlü teknik kanıt yoksa 55 üstüne çıkma. Gerekçede sınırlı sinyali açıkça belirt.]`
        : `\n\n[EVALUATION_NOTE: The transcript may include many silence/timeout lines or very short candidate answers. Do not inflate the overall score; avoid scores above ~55 unless there is strong technical evidence. Explicitly reflect the limited signal in category reasons and weaknesses.]`;

    const unansweredEvalNote =
      transcriptQuality.unansweredTurnCount > 0
        ? locale === "tr"
          ? `\n\n[DEGERLENDIRME_NOTU: Transkriptte ${transcriptQuality.unansweredTurnCount} soru unanswered/no_response olarak isaretli. Bunlari kacirilmis soru olarak degerlendir ve genel puani buna gore dusur.]`
          : `\n\n[EVALUATION_NOTE: The transcript marks ${transcriptQuality.unansweredTurnCount} question(s) as unanswered/no_response. Treat those as missed answers and lower the overall assessment accordingly.]`
        : "";
    const evaluationTranscriptPayload = transcriptQuality.isLowSignal
      ? `${transcriptStr}${lowSignalEvalNote}${unansweredEvalNote}`
      : `${transcriptStr}${unansweredEvalNote}`;

    const groq = getGroq();
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: GROQ_MOCK_INTERVIEW_MODEL,
        temperature: 0,
        response_format: GROQ_JSON_OBJECT_RESPONSE_FORMAT,
        messages: [
          {
            role: "system",
            content: evalSystem,
          },
          {
            role: "user",
            content: evaluationTranscriptPayload,
          },
        ],
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

    const text = completion.choices[0]?.message?.content ?? "";
    if (!text.trim()) {
      logWarn("mock-interview result Groq returned empty content — using fallback evaluation");
      captureMessage("Mock interview result: empty model output, fallback evaluation", {
        route: "/api/mock-interview/result",
        user_id: user.id,
        ...(jobId ? { job_id: jobId } : {}),
        aiInterview: { stage: "evaluation", reason: "empty_model" },
      });
    }

    const normalized = parseInterviewEvaluationModelOutput(text.trim() ? text : "");
    if (normalized.usedFallback) {
      logWarn("mock-interview result: parser used fallback scores", { jobCategory });
      captureMessage("Mock interview result: fallback scoring used", {
        route: "/api/mock-interview/result",
        user_id: user.id,
        ...(jobId ? { job_id: jobId } : {}),
        aiInterview: { stage: "evaluation", reason: "fallback_scoring_used" },
      });
    }

    let overallScore = normalized.overallScore;
    if (transcriptQuality.scoreCap != null && overallScore > transcriptQuality.scoreCap) {
      overallScore = transcriptQuality.scoreCap;
    }
    const technicalScore = normalized.technicalScore;
    const communicationScore = normalized.communicationScore;
    const problemSolvingScore = normalized.problemSolvingScore;
    const categories = normalized.categories;
    const answerBreakdown = normalized.answerBreakdown;
    const hireRecommendation = normalized.hireRecommendation;
    const strengths = normalized.strengths;
    const improvements = normalized.improvements;
    const justification = normalized.justification;

    const report: Record<string, unknown> = {
      final_score: overallScore,
      categories,
      answer_breakdown: answerBreakdown,
      strengths,
      improvements,
      evaluation_meta: {
        used_fallback: normalized.usedFallback,
        transcript_signal: transcriptQuality.isLowSignal ? "low" : "normal",
        ...(transcriptQuality.scoreCap != null ? { transcript_score_cap: transcriptQuality.scoreCap } : {}),
        ...(transcriptQuality.unansweredTurnCount > 0
          ? { unanswered_turn_count: transcriptQuality.unansweredTurnCount }
          : {}),
        source: "post_interview_evaluation",
        pipeline_version: MOCK_INTERVIEW_PIPELINE_VERSION,
      },
    };
    if (hireRecommendation) report.hire_recommendation = hireRecommendation;
    if (justification) report.justification = justification;
    if (technicalScore !== null) report.technical_score = technicalScore;
    if (communicationScore !== null) report.communication_score = communicationScore;
    if (problemSolvingScore !== null) report.problem_solving_score = problemSolvingScore;

    const upsertRow: Record<string, unknown> = {
      id: sessionIdRaw,
      user_id: user.id,
      job_category: jobCategory,
      score: overallScore,
      report,
      transcript: transcriptStr,
      interview_language: locale,
      model_version: GROQ_MOCK_INTERVIEW_MODEL,
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
      ...(jobId ? { job_id: jobId } : {}),
    });

    const responsePayload = {
      interview_id: sessionIdRaw,
      score: overallScore,
      final_score: overallScore,
      overall_score: overallScore,
      categories,
      answer_breakdown: answerBreakdown,
      strengths,
      improvements,
      evaluation_used_fallback: normalized.usedFallback,
      ...(hireRecommendation && { hire_recommendation: hireRecommendation }),
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
