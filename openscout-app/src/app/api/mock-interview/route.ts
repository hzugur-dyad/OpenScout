import { NextRequest, NextResponse } from "next/server";
import { getGroq } from "@/lib/groq";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { checkProfileAndCv } from "@/lib/profile-guard";

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

    const { messages, jobCategory, userName, jobId } = await request.json();
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
        const numberedList = questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
        customQuestionsBlock = `

You are conducting this interview for a specific job. The employer provided the following questions. You MUST ask these questions FIRST, in order (1, then 2, then 3, etc.).
Use the conversation history to see which of these you have already asked. Ask the NEXT unanswered question in the list. Do NOT repeat a question that was already asked.
Ask one question at a time and wait for the candidate's response before moving to the next.
After ALL of these employer questions have been asked and answered, you may continue with additional relevant interview questions if appropriate.

Employer-provided questions (ask in this order):
${numberedList}

`;
      }
    }

    const systemPrompt = `You are an AI interviewer for the ${jobCategory} position. You are conducting a live interview with ${userName || "the candidate"}.
IMPORTANT — First message only: Start with a short, warm greeting in English using the candidate's name. For example: "Hi ${userName || "there"}, how are you?" or "Hello ${userName || "there"}, welcome." Keep it to one short, natural sentence, then move to the first question. Everything you say must be in English only.
Ask realistic interview questions. Use technical and behavioral questions. Respond briefly, naturally, and conversationally in English only.
Ask one question at a time or give short replies. Do not write long paragraphs.${customQuestionsBlock}
Adaptive follow-ups: Use the conversation history (the last interviewer question and the candidate's response). Before moving to the next main question, decide if a follow-up is needed:
- If the candidate's answer is incomplete, vague, or too short: ask ONE follow-up question to clarify or ask for a concrete example. The follow-up must relate directly to what they just said.
- If the candidate's answer is strong and detailed: you may ask ONE deeper question on the same topic to validate their knowledge, then move on.
- Maximum ONE follow-up per main question. Do not ask multiple follow-ups for the same topic; after the candidate responds to your follow-up, move to the next main question. Do not repeat questions.
If the user was silent, did not answer, or their message indicates they could not be heard or understood, respond with a short natural phrase like: "I didn't catch that, could you repeat?" or "Sorry, I couldn't hear you clearly. Would you mind saying that again?" Do not explain at length.
When the interview ends, write "INTERVIEW_ENDED" and then provide a JSON with score and report:
{"score": 0-100, "strengths": [], "improvements": []}`;

    const groq = getGroq();
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0.35,
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
