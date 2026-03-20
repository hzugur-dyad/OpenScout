import { NextRequest, NextResponse } from "next/server";
import { getGroq } from "@/lib/groq";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { checkProfileAndCv } from "@/lib/profile-guard";
import { parseInterviewLocale, type InterviewLocale } from "@/lib/interview-locale";
import {
  buildEmployerQuestionsBlockEn,
  buildEmployerQuestionsBlockTr,
  buildInterviewerSystemPrompt,
} from "@/lib/mock-interview-prompt";

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

    const key = `mock-int:${user.id}`;
    if (!checkRateLimit(key, RATE_LIMITS.mockInterview.limit, RATE_LIMITS.mockInterview.windowMs)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const { messages, jobCategory, userName, jobId, interviewLanguage } = await request.json();
    const locale: InterviewLocale = parseInterviewLocale(
      typeof interviewLanguage === "string" ? interviewLanguage : undefined
    );
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logWarn("mock-interview validation failed", { reason: "messages required" });
      return NextResponse.json(
        { error: "messages required" },
        { status: 400 }
      );
    }

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
    const systemPrompt = buildInterviewerSystemPrompt(locale, {
      jobCategory,
      displayName,
      userName: userName && typeof userName === "string" ? userName : "",
      customQuestionsBlock,
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
