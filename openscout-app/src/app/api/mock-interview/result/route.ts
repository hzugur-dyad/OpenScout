import { NextRequest, NextResponse } from "next/server";
import { getGroq } from "@/lib/groq";

export async function POST(request: NextRequest) {
  try {
    const { transcript, jobCategory } = await request.json();
    if (!transcript) {
      return NextResponse.json(
        { error: "transcript required" },
        { status: 400 }
      );
    }

    const groq = getGroq();
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `You are an interview evaluation expert. Evaluate the following interview transcript for the ${jobCategory} position.
Respond ONLY in this JSON format, no other text:
{
  "score": 0-100,
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["improvement1", "improvement2", "improvement3"]
}
Return ONLY valid JSON. Do not include explanations.`,
        },
        {
          role: "user",
          content: transcript,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) throw new Error("No response from model");

    let result: { score?: number; strengths?: string[]; improvements?: string[] };
    try {
      result = JSON.parse(text) as typeof result;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON from model" },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Evaluation error" },
      { status: 500 }
    );
  }
}
