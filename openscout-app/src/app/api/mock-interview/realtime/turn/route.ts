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
import { createClient } from "@/lib/supabase/server";
import { parseJsonBody } from "@/lib/api-validation";
import { generateInterviewTurnPlan } from "@/services/ai";
import type {
  InterviewJobContext,
  InterviewQuestionHistoryEntry,
  InterviewTranscriptEntry,
} from "@/services/interview";
import { mockInterviewRealtimeTurnSchema } from "@/types/schemas";

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
  logInfo("mock-interview realtime turn request received");

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const guard = await checkProfileAndCv(supabase, user.id);
    if (!guard.canApplyOrInterview) {
      return NextResponse.json(
        {
          error:
            "Complete your profile and add a CV (upload or CV analysis) before starting a mock interview.",
        },
        { status: 403 }
      );
    }

    const parsed = await parseJsonBody(request, mockInterviewRealtimeTurnSchema);
    if (!parsed.ok) {
      logWarn("mock-interview realtime turn validation failed", { reason: "body schema" });
      return parsed.response;
    }

    const {
      sessionId,
      jobCategory,
      userName,
      jobId,
      interviewLanguage,
      transcript,
      currentControl,
      questionHistory = [],
      lastUserMessage = "",
      turnKind = "voice_turn",
    } = parsed.data;

    if (!isRateLimitBypassed(user)) {
      const rlId = getRateLimitIdentifier(request, user.id);
      const limited = await rateLimitForKind(turnKind === "opening" ? "mockInterviewStart" : "mockInterviewTurn", rlId);
      if (!limited.success) return tooManyRequestsResponse(limited);
    }

    const locale: InterviewLocale = parseInterviewLocale(interviewLanguage);

    let jobContext: InterviewJobContext = {
      role: jobCategory,
      description: "",
      requirements: "",
      customQuestions: [],
    };

    if (jobId) {
      const { data: row } = await supabase
        .from("job_listings")
        .select("title, description, requirements, ai_interview_config")
        .eq("id", jobId)
        .maybeSingle();

      jobContext = normalizeJobContext(jobCategory, row as {
        title?: string | null;
        description?: string | null;
        requirements?: string | null;
        ai_interview_config?: unknown;
      } | null);
    }

    const plan = await generateInterviewTurnPlan({
      locale,
      displayName: userName?.trim() || (locale === "tr" ? "aday" : "there"),
      transcript: transcript as InterviewTranscriptEntry[],
      jobContext,
      currentControl,
      questionHistory: questionHistory as InterviewQuestionHistoryEntry[],
      lastUserMessage,
      turnKind,
    });

    return NextResponse.json({
      sessionId,
      nextQuestion: plan.nextQuestion,
      followUp: plan.followUp,
      evaluationHint: plan.evaluationHint,
      difficulty: plan.difficulty,
      isOffTopic: plan.isOffTopic,
      questionSource: plan.questionSource,
      closingLine: plan.closingLine,
      control: plan.control,
      speechInstructions: plan.speechInstructions,
    });
  } catch (error) {
    logError("mock-interview realtime turn unexpected error", error);
    captureException(error, { route: "/api/mock-interview/realtime/turn" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to plan interview turn." },
      { status: 500 }
    );
  }
}
