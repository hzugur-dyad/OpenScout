import { NextRequest, NextResponse } from "next/server";
import { getGroq } from "@/lib/groq";
import { createClient } from "@/lib/supabase/server";
import { getRateLimitIdentifier, rateLimitForKind, tooManyRequestsResponse } from "@/lib/rate-limit";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { checkProfileAndCv } from "@/lib/profile-guard";
import { parseInterviewLocale, type InterviewLocale } from "@/lib/interview-locale";
import {
  buildEmployerQuestionsBlockEn,
  buildEmployerQuestionsBlockTr,
  buildInterviewerSystemPrompt,
} from "@/lib/mock-interview-prompt";
import { parseJsonBody } from "@/lib/api-validation";
import { interviewResponseSchema } from "@/types/schemas";

export async function POST(request: NextRequest) {
  logInfo("mock-interview request received");
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
      if (!guard.hasCv) reasons.push("Complete at least one CV analysis");
      return NextResponse.json(
        { error: "Complete your profile and run a CV analysis before starting a mock interview.", details: reasons },
        { status: 403 }
      );
    }

    const rlId = getRateLimitIdentifier(request, user.id);
    const limited = await rateLimitForKind("mockInterview", rlId);
    if (!limited.success) return tooManyRequestsResponse(limited);

    const parsed = await parseJsonBody(request, interviewResponseSchema);
    if (!parsed.ok) {
      logWarn("mock-interview validation failed", { reason: "body schema" });
      return parsed.response;
    }
    const { messages, jobCategory, userName, jobId, interviewLanguage, interviewControl } =
      parsed.data;
    const locale: InterviewLocale = parseInterviewLocale(interviewLanguage);

    let customQuestionsBlock = "";
    if (jobId && typeof jobId === "string") {
      const { data: job } = await supabase
        .from("job_listings")
        .select("ai_interview_config")
        .eq("id", jobId.trim())
        .maybeSingle();
      const config = (job?.ai_interview_config as { custom_questions?: string[] } | null) ?? {};
      const questions = config.custom_questions?.filter((q) => typeof q === "string" && q.trim()) ?? [];
      if (questions.length > 0) {
        customQuestionsBlock =
          locale === "tr"
            ? buildEmployerQuestionsBlockTr(questions)
            : buildEmployerQuestionsBlockEn(questions);
      }
    }

    const displayName = userName && typeof userName === "string" ? userName.trim() || "there" : "there";
    const controlHint =
      interviewControl &&
      typeof interviewControl === "object" &&
      typeof (interviewControl as { questionId?: unknown }).questionId === "string" &&
      typeof (interviewControl as { attemptCount?: unknown }).attemptCount === "number"
        ? locale === "tr"
          ? `\nKONTROL BAĞLAMI: Mevcut soru=${(interviewControl as { questionId: string }).questionId}, attempt=${Math.max(1, Math.min(2, (interviewControl as { attemptCount: number }).attemptCount))}. Eğer attempt=2 ve önceki yanıt hala partial/incorrect ise next_action=\"next\" seç ve yeni question_id üret.`
          : `\nCONTROL CONTEXT: Current question=${(interviewControl as { questionId: string }).questionId}, attempt=${Math.max(1, Math.min(2, (interviewControl as { attemptCount: number }).attemptCount))}. If attempt=2 and previous answer is still partial/incorrect, set next_action=\"next\" and move to a new question_id.`
        : "";
    const systemPrompt = buildInterviewerSystemPrompt(locale, {
      jobCategory,
      displayName,
      userName: userName && typeof userName === "string" ? userName : "",
      customQuestionsBlock,
      controlHint,
    });

    const groq = getGroq();
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0.5,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      });
    } catch (groqError) {
      logError("mock-interview Groq request failed", groqError);
      return NextResponse.json(
        { error: groqError instanceof Error ? groqError.message : "Interview error" },
        { status: 500 }
      );
    }

    const content = completion.choices[0]?.message?.content || "";
    return NextResponse.json({ content });
  } catch (e) {
    logError("mock-interview unexpected error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Interview error" },
      { status: 500 }
    );
  }
}
