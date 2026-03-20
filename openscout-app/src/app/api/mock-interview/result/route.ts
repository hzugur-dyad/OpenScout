import { NextRequest, NextResponse } from "next/server";
import { getGroq } from "@/lib/groq";
import { createClient } from "@/lib/supabase/server";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { canUseFeature, logUsage, getUserPlan } from "@/lib/usage";
import { checkProfileAndCv } from "@/lib/profile-guard";
import { parseInterviewLocale, type InterviewLocale } from "@/lib/interview-locale";

export async function POST(request: NextRequest) {
  logInfo("mock-interview result request received");
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const guard = await checkProfileAndCv(supabase, user.id);
    if (!guard.canApplyOrInterview) {
      return NextResponse.json(
        { error: "Complete your profile and run a CV analysis before submitting interview results." },
        { status: 403 }
      );
    }

    const { transcript, jobCategory, jobId, interviewLanguage } = await request.json();
    const locale: InterviewLocale = parseInterviewLocale(
      typeof interviewLanguage === "string" ? interviewLanguage : undefined
    );
    if (!transcript) {
      logWarn("mock-interview result validation failed", { reason: "transcript required" });
      return NextResponse.json(
        { error: "transcript required" },
        { status: 400 }
      );
    }

    const groq = getGroq();
    const evalSystemEn = `You are an interview evaluation expert. Evaluate the following interview transcript for the ${jobCategory} position.
Respond ONLY in this JSON format, no other text:
{
  "overall_score": 0-100,
  "technical_score": 0-100,
  "communication_score": 0-100,
  "problem_solving_score": 0-100,
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["improvement1", "improvement2", "improvement3"]
}
All score fields are numbers from 0 to 100. overall_score should reflect the overall performance; technical_score for technical accuracy and depth; communication_score for clarity and articulation; problem_solving_score for reasoning and approach.
The "strengths" and "improvements" array strings must be in English.
Return ONLY valid JSON. Do not include explanations.`;

    const evalSystemTr = `Sen bir mülakat değerlendirme uzmanısın. Aşağıdaki mülakat transkriptini ${jobCategory} pozisyonu için değerlendir.
YALNIZCA şu JSON biçiminde yanıt ver, başka metin ekleme:
{
  "overall_score": 0-100,
  "technical_score": 0-100,
  "communication_score": 0-100,
  "problem_solving_score": 0-100,
  "strengths": ["güçlü1", "güçlü2", "güçlü3"],
  "improvements": ["öneri1", "öneri2", "öneri3"]
}
Tüm puan alanları 0 ile 100 arasında sayı olmalı. overall_score genel performansı; technical_score teknik doğruluk ve derinliği; communication_score netlik ve ifadeyi; problem_solving_score akıl yürütme ve yaklaşımı yansıtmalı.
"strengths" ve "improvements" dizilerindeki metinler Türkçe olmalı.
YALNIZCA geçerli JSON döndür. Açıklama ekleme.`;

    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: locale === "tr" ? evalSystemTr : evalSystemEn,
          },
          {
            role: "user",
            content: transcript,
          },
        ],
      });
    } catch (groqError) {
      logError("mock-interview result Groq request failed", groqError);
      return NextResponse.json(
        { error: groqError instanceof Error ? groqError.message : "Evaluation error" },
        { status: 500 }
      );
    }

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      logError("mock-interview result Groq returned empty content", undefined);
      throw new Error("No response from model");
    }

    type EvaluationResult = {
      overall_score?: number;
      score?: number;
      technical_score?: number;
      communication_score?: number;
      problem_solving_score?: number;
      strengths?: string[];
      improvements?: string[];
    };
    let result: EvaluationResult;
    try {
      result = JSON.parse(text) as EvaluationResult;
    } catch {
      logError("mock-interview result invalid JSON from model", undefined);
      return NextResponse.json(
        { error: "Invalid JSON from model" },
        { status: 500 }
      );
    }

    const overallScore =
      typeof result.overall_score === "number" ? result.overall_score
      : typeof result.score === "number" ? result.score
      : 0;
    const technicalScore = typeof result.technical_score === "number" ? result.technical_score : null;
    const communicationScore = typeof result.communication_score === "number" ? result.communication_score : null;
    const problemSolvingScore = typeof result.problem_solving_score === "number" ? result.problem_solving_score : null;
    const strengths = Array.isArray(result.strengths) ? result.strengths.filter((s) => typeof s === "string") : [];
    const improvements = Array.isArray(result.improvements) ? result.improvements.filter((s) => typeof s === "string") : [];

    const report: {
      strengths: string[];
      improvements: string[];
      technical_score?: number;
      communication_score?: number;
      problem_solving_score?: number;
    } = { strengths, improvements };
    if (technicalScore !== null) report.technical_score = technicalScore;
    if (communicationScore !== null) report.communication_score = communicationScore;
    if (problemSolvingScore !== null) report.problem_solving_score = problemSolvingScore;

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle();
    const plan = getUserPlan(profile?.plan);
    const { allowed, used, limit } = await canUseFeature(supabase, user.id, "mock_interview", plan);
    if (!allowed) {
      return NextResponse.json(
        { error: "Weekly mock interview limit reached. Upgrade your plan for more.", used, limit },
        { status: 403 }
      );
    }

    if (!jobCategory) {
      logWarn("mock-interview result validation failed", { reason: "jobCategory required" });
      return NextResponse.json({ error: "jobCategory required" }, { status: 400 });
    }

    const { error: insertError } = await supabase.from("mock_interviews").insert({
      user_id: user.id,
      job_category: jobCategory,
      ...(jobId && typeof jobId === "string" && jobId.trim() ? { job_id: jobId.trim() } : {}),
      score: overallScore,
      report,
    });

    if (insertError) {
      logError("mock-interview result insert failed", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await logUsage(supabase, user.id, "mock_interview");

    const responsePayload = {
      score: overallScore,
      overall_score: overallScore,
      strengths,
      improvements,
      ...(technicalScore !== null && { technical_score: technicalScore }),
      ...(communicationScore !== null && { communication_score: communicationScore }),
      ...(problemSolvingScore !== null && { problem_solving_score: problemSolvingScore }),
    };
    return NextResponse.json(responsePayload);
  } catch (e) {
    logError("mock-interview result unexpected error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Evaluation error" },
      { status: 500 }
    );
  }
}
