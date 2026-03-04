import { NextRequest, NextResponse } from "next/server";
import { getGroq } from "@/lib/groq";

export async function POST(request: NextRequest) {
  try {
    const { messages, jobCategory, userName } = await request.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages required" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are an AI interviewer for the ${jobCategory} position. You are conducting a live interview with ${userName || "the candidate"}.
Ask realistic interview questions. Use technical and behavioral questions. Respond briefly, naturally, and conversationally in English.
Ask one question at a time or give short replies. Do not write long paragraphs.
If the user was silent, did not answer, or their message indicates they could not be heard or understood, respond with a short natural phrase like: "I didn't catch that, could you repeat?" or "Sorry, I couldn't hear you clearly. Would you mind saying that again?" Do not explain at length.
When the interview ends, write "INTERVIEW_ENDED" and then provide a JSON with score and report:
{"score": 0-100, "strengths": [], "improvements": []}`;

    const groq = getGroq();
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.35,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    });

    const content = completion.choices[0]?.message?.content || "";
    return NextResponse.json({ content });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Interview error" },
      { status: 500 }
    );
  }
}
