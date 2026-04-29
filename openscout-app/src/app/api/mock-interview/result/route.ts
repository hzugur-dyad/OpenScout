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
import { hashInterviewTranscript, normalizeInterviewSessionId } from "@/lib/mock-interview/session-security";
import { normalizeInterviewTranscriptText } from "@/lib/mock-interview/transcript";
import { GROQ_MOCK_INTERVIEW_MODEL, MOCK_INTERVIEW_PIPELINE_VERSION } from "@/lib/mock-interview/versioning";
import { assessInterviewTranscriptQuality } from "@/lib/mock-interview/transcript-quality";
import { captureException, captureMessage } from "@/lib/monitoring";

function buildEmployerEvalRubricBlock(jobRow: { ai_interview_config?: unknown } | null): string {
  const config = jobRow?.ai_interview_config as { custom_questions?: unknown } | undefined;
  const qs = Array.isArray(config?.custom_questions)
    ? config.custom_questions.filter((q): q is string => typeof q === "string" && q.trim().length > 0)
    : [];
  if (qs.length === 0) return "";
  return qs.map((q, i) => `${i + 1}. ${q.trim()}`).join("\n");
}

function buildStoredInterviewResultPayload(
  sessionId: string,
  row: { score?: number | null; report?: Record<string, unknown> | null }
) {
  const report = (row.report as Record<string, unknown> | null) ?? {};
  const finalScore =
    typeof row.score === "number"
      ? row.score
      : typeof report.final_score === "number"
        ? report.final_score
        : 0;

  return {
    interview_id: sessionId,
    score: finalScore,
    final_score: finalScore,
    overall_score: finalScore,
    confidence: report.confidence,
    coverage_score: report.coverage_score,
    is_preliminary: report.is_preliminary,
    competency_breakdown: report.competency_breakdown,
    categories: report.categories,
    question_evaluations: report.question_evaluations,
    answer_breakdown: report.answer_breakdown,
    strengths: report.strengths,
    weaknesses: report.weaknesses,
    improvements: report.improvements,
    summary: report.summary,
    evaluation_used_fallback:
      (report.evaluation_meta as { used_fallback?: unknown } | undefined)?.used_fallback === true,
    ...(typeof report.hire_recommendation === "string"
      ? { hire_recommendation: report.hire_recommendation }
      : {}),
    ...(typeof report.justification === "string" ? { justification: report.justification } : {}),
    ...(typeof report.technical_score === "number" ? { technical_score: report.technical_score } : {}),
    ...(typeof report.communication_score === "number"
      ? { communication_score: report.communication_score }
      : {}),
    ...(typeof report.problem_solving_score === "number"
      ? { problem_solving_score: report.problem_solving_score }
      : {}),
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

    const sessionIdRaw = normalizeInterviewSessionId(b.sessionId) ?? "";
    if (!sessionIdRaw) {
      logWarn("mock-interview result validation failed", { reason: "sessionId" });
      return NextResponse.json({ error: "sessionId must be a valid interview session UUID" }, { status: 400 });
    }

    const transcriptStr = typeof b.transcript === "string" ? b.transcript : "";
    if (!transcriptStr.trim()) {
      logWarn("mock-interview result validation failed", { reason: "transcript required" });
      return NextResponse.json({ error: "transcript required" }, { status: 400 });
    }
    const canonicalTranscript = normalizeInterviewTranscriptText(transcriptStr);
    const transcriptHash = hashInterviewTranscript(canonicalTranscript);

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

    const { data: existingSession } = await supabase
      .from("mock_interviews")
      .select("job_category, job_id, interview_language, session_state, transcript_hash, report, score")
      .eq("id", sessionIdRaw)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingSession) {
      logWarn("mock-interview result rejected: missing session seed", { sessionId: sessionIdRaw });
      return NextResponse.json(
        { error: "Interview session was not started from this account. Start a new interview." },
        { status: 409 }
      );
    }

    const sessionJobCategory = typeof existingSession.job_category === "string" ? existingSession.job_category : "";
    const sessionJobId =
      typeof (existingSession as { job_id?: unknown }).job_id === "string"
        ? ((existingSession as { job_id: string }).job_id || null)
        : null;
    const sessionLocale =
      typeof existingSession.interview_language === "string" ? existingSession.interview_language : null;
    const sessionState =
      typeof existingSession.session_state === "string" ? existingSession.session_state : "started";
    const storedTranscriptHash =
      typeof existingSession.transcript_hash === "string" ? existingSession.transcript_hash : null;

    if (sessionJobCategory && sessionJobCategory !== jobCategory) {
      return NextResponse.json({ error: "Interview session metadata mismatch. Start a new interview." }, { status: 409 });
    }
    if ((sessionJobId ?? undefined) !== (jobId ?? undefined)) {
      return NextResponse.json({ error: "Interview job context mismatch. Start a new interview." }, { status: 409 });
    }
    if (sessionLocale && sessionLocale !== locale) {
      return NextResponse.json({ error: "Interview language mismatch. Start a new interview." }, { status: 409 });
    }
    if (!storedTranscriptHash) {
      return NextResponse.json({ error: "Interview session is out of sync. Start a new interview." }, { status: 409 });
    }
    if (storedTranscriptHash !== transcriptHash) {
      logWarn("mock-interview result rejected: transcript hash mismatch", { sessionId: sessionIdRaw });
      return NextResponse.json({ error: "Interview transcript mismatch. Start a new interview." }, { status: 409 });
    }
    if (sessionState === "completed") {
      return NextResponse.json(buildStoredInterviewResultPayload(sessionIdRaw, existingSession), { status: 200 });
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

    const transcriptQuality = assessInterviewTranscriptQuality(canonicalTranscript);
    const lowSignalEvalNote =
      locale === "tr"
        ? `\n\n[DEGERLENDIRME_NOTU: Transkriptte cok sayida sessizlik/zaman asimi satiri veya asiri kisa aday yanitlari olabilir. Bunu sinirli kanit olarak kabul et. Guclu transcript kaniti yoksa strong etiketi veya yuksek competency skoru verme.]`
        : `\n\n[EVALUATION_NOTE: The transcript may include many silence/timeout lines or very short candidate answers. Treat this as limited evidence. Do not award strong labels or high competency scores unless the transcript clearly supports them.]`;

    const unansweredEvalNote =
      transcriptQuality.unansweredTurnCount > 0
        ? locale === "tr"
          ? `\n\n[DEGERLENDIRME_NOTU: Transkriptte ${transcriptQuality.unansweredTurnCount} soru unanswered/no_response olarak isaretli. Anlamli cevap yoksa answered=false, label=no_response, score=0 ve tum competency skorlerini 0 ver.]`
          : `\n\n[EVALUATION_NOTE: The transcript marks ${transcriptQuality.unansweredTurnCount} question(s) as unanswered/no_response. When there is no meaningful answer, set answered=false, label=no_response, score=0, and every competency score to 0.]`
        : "";
    const evaluationTranscriptPayload = transcriptQuality.isLowSignal
      ? `${canonicalTranscript}${lowSignalEvalNote}${unansweredEvalNote}`
      : `${canonicalTranscript}${unansweredEvalNote}`;

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
      logWarn("mock-interview result Groq returned empty content - using fallback evaluation");
      captureMessage("Mock interview result: empty model output, fallback evaluation", {
        route: "/api/mock-interview/result",
        user_id: user.id,
        ...(jobId ? { job_id: jobId } : {}),
        aiInterview: { stage: "evaluation", reason: "empty_model" },
      });
    }

    const normalized = parseInterviewEvaluationModelOutput(text.trim() ? text : "", {
      transcriptQuality,
    });
    if (normalized.usedFallback) {
      logWarn("mock-interview result: parser used fallback scores", { jobCategory });
      captureMessage("Mock interview result: fallback scoring used", {
        route: "/api/mock-interview/result",
        user_id: user.id,
        ...(jobId ? { job_id: jobId } : {}),
        aiInterview: { stage: "evaluation", reason: "fallback_scoring_used" },
      });
    }

    const overallScore = normalized.finalScore;
    const technicalScore = normalized.technicalScore;
    const communicationScore = normalized.communicationScore;
    const problemSolvingScore = normalized.problemSolvingScore;
    const confidence = normalized.confidence;
    const coverageScore = normalized.coverageScore;
    const isPreliminary = normalized.isPreliminary;
    const competencyBreakdown = normalized.competencyBreakdown;
    const categories = normalized.categories;
    const questionEvaluations = normalized.questionEvaluations;
    const answerBreakdown = normalized.answerBreakdown;
    const hireRecommendation = normalized.hireRecommendation;
    const strengths = normalized.strengths;
    const weaknesses = normalized.weaknesses;
    const improvements = normalized.improvements;
    const summary = normalized.summary;
    const justification = normalized.justification;

    const report: Record<string, unknown> = {
      final_score: overallScore,
      confidence,
      coverage_score: coverageScore,
      is_preliminary: isPreliminary,
      competency_breakdown: competencyBreakdown,
      categories,
      question_evaluations: questionEvaluations,
      answer_breakdown: answerBreakdown,
      strengths,
      weaknesses,
      improvements,
      summary,
      evaluation_meta: {
        used_fallback: normalized.usedFallback,
        transcript_signal: transcriptQuality.isLowSignal ? "low" : "normal",
        transcript_signal_strength: transcriptQuality.signalStrength,
        total_questions: normalized.coverage.totalQuestions,
        answered_questions: normalized.coverage.answeredQuestions,
        usable_answer_count: normalized.coverage.usableAnswerCount,
        competencies_covered_count: normalized.coverage.competenciesCoveredCount,
        confidence,
        coverage_score: coverageScore,
        is_preliminary: isPreliminary,
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
    report.confidence_score = normalized.confidenceScore;
    if (technicalScore !== null) report.technical_score = technicalScore;
    if (communicationScore !== null) report.communication_score = communicationScore;
    if (problemSolvingScore !== null) report.problem_solving_score = problemSolvingScore;

    const updateRow: Record<string, unknown> = {
      job_category: jobCategory,
      score: overallScore,
      report,
      transcript: canonicalTranscript,
      transcript_hash: transcriptHash,
      interview_language: locale,
      model_version: GROQ_MOCK_INTERVIEW_MODEL,
      prompt_version: MOCK_INTERVIEW_PIPELINE_VERSION,
      session_state: "completed",
      completed_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    };
    if (jobId) updateRow.job_id = jobId;
    if (durationMs !== null) updateRow.duration_ms = durationMs;

    const { error: updateError } = await supabase
      .from("mock_interviews")
      .update(updateRow)
      .eq("id", sessionIdRaw)
      .eq("user_id", user.id);

    if (updateError) {
      logError("mock-interview result update failed", updateError);
      captureException(updateError, {
        route: "/api/mock-interview/result",
        user_id: user.id,
        ...(jobId ? { job_id: jobId } : {}),
      });
      return NextResponse.json({ error: updateError.message }, { status: 500 });
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
      confidence,
      coverage_score: coverageScore,
      is_preliminary: isPreliminary,
      competency_breakdown: competencyBreakdown,
      categories,
      question_evaluations: questionEvaluations,
      answer_breakdown: answerBreakdown,
      strengths,
      weaknesses,
      improvements,
      summary,
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
