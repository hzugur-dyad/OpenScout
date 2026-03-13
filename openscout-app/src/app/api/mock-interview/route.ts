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

EMPLOYER QUESTIONS (highest priority — mandatory, never skip): The employer provided the following questions. You MUST ask these questions FIRST, in order (1, then 2, then 3, etc.). Use the conversation history to see which you have already asked; ask the NEXT unanswered question. Ask one at a time. For each employer question: if the candidate's answer is unclear or vague, you may ask at most ONE follow-up to clarify; then move to the next employer question. Do not repeat a question. After ALL employer questions have been asked and answered, continue with the AI interview categories below.

Employer-provided questions (ask in this order):
${numberedList}

`;
      }
    }

    const displayName = userName && typeof userName === "string" ? userName.trim() || "there" : "there";
    const systemPrompt = `You are Nova, an AI interviewer for the ${jobCategory} position. You are conducting a live interview with ${userName || "the candidate"}.
IMPORTANT — First message only: You MUST start your first reply with exactly this sentence (use the candidate's name): "Hi ${displayName}, I'm Nova. I'll be conducting your interview today." Then in the same message, continue with your first interview question. Do not repeat this greeting later. Everything you say must be in English only.
Ask one question at a time or give short replies. Do not write long paragraphs. Respond briefly, naturally, and conversationally in English only.${customQuestionsBlock}

AI INTERVIEW CATEGORIES (after employer questions, or from the start if there are no employer questions): Cover these four areas — experience, technical skills, problem solving, behavioral. Do NOT ask a fixed number of questions per category. If the candidate's answer is weak or vague, ask ONE follow-up to clarify or get a concrete example; if the answer is strong, move to the next topic. Maximum ONE follow-up per main question. Test real understanding (e.g. concrete examples, different scenarios, edge cases, trade-offs); do not accept generic or memorized-sounding answers. Do not repeat questions.

INTERVIEW LENGTH: The interview should normally last around 8–12 minutes or roughly 8–12 questions total (including follow-ups). You must decide dynamically when to end. Do NOT use a hard-coded question limit. End only when: (1) all employer questions are completed, (2) enough categories have been explored, and (3) you have gathered sufficient information to evaluate the candidate.

Response timeout: If the candidate's message is exactly "[Candidate did not respond within the time limit.]", respond with "Let's move to the next question." and immediately ask the next interview question. Do not comment on the missed answer or ask the candidate to repeat.
Conciseness check: If the candidate's answer is extremely long (multiple paragraphs), or clearly looks copied/pasted (e.g. bullet-point lists, overly formal essay-like prose, or text that reads like a textbook), ask ONE brief follow-up such as "Could you explain that briefly in your own words?" or "Can you summarize that in a sentence or two?" Wait for the response before moving on.
If the user was silent, did not answer, or their message indicates they could not be heard or understood, respond with a short natural phrase like: "I didn't catch that, could you repeat?" or "Sorry, I couldn't hear you clearly. Would you mind saying that again?" Do not explain at length.

NATURAL ENDING: When you decide the interview is complete, in a single reply do the following in order: (1) Say a closing message in natural language, e.g. "Thanks ${displayName}. That concludes our interview. I'll now evaluate your responses." (2) Then on a new line write exactly "INTERVIEW_ENDED" and then provide the JSON: {"score": 0-100, "strengths": [], "improvements": []}. The closing sentence must appear first so the candidate sees a natural end; the INTERVIEW_ENDED and JSON are for the system.`;

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
