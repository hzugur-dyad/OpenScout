import { NextRequest, NextResponse } from "next/server";
import { getGroq } from "@/lib/groq";
import { createClient } from "@/lib/supabase/server";
import { logError, logInfo } from "@/lib/logger";

const CATEGORY_KEYS = [
  "professional_summary",
  "work_experience",
  "skills",
  "education",
  "online_presence",
  "highlights",
] as const;

const WEIGHTS: Record<string, number> = {
  professional_summary: 0.15,
  work_experience: 0.30,
  skills: 0.25,
  education: 0.15,
  online_presence: 0.05,
  highlights: 0.10,
};

function clampScore(n: number): number {
  return Math.round(Math.min(100, Math.max(0, Number(n))));
}

function computeOverallScore(categoryScores: Record<string, number>): number {
  let sum = 0;
  let totalWeight = 0;
  for (const key of CATEGORY_KEYS) {
    const v = categoryScores[key];
    if (typeof v === "number" && !Number.isNaN(v)) {
      sum += clampScore(v) * (WEIGHTS[key] ?? 0.1);
      totalWeight += WEIGHTS[key] ?? 0.1;
    }
  }
  if (totalWeight <= 0) return 50;
  return Math.round(sum / totalWeight);
}

function extractJsonFromText(raw: string): string {
  let s = raw.trim();
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```\s*$/m;
  const m = s.match(codeBlock);
  if (m) s = m[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return s.slice(start, end + 1);
  return s;
}

/**
 * Auto CV analysis for job applications.
 * Uses the candidate's stored CV text, analyzes it against the job.
 * Does NOT count toward candidate weekly usage -- cost is on the employer.
 */
export async function POST(request: NextRequest) {
  logInfo("cv-analysis/auto request received");
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const jobId = typeof (body as { jobId?: string }).jobId === "string"
      ? (body as { jobId: string }).jobId.trim()
      : "";

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    // Check if analysis already exists for this job + user
    const { data: existing } = await supabase
      .from("cv_analyses")
      .select("overall_score")
      .eq("user_id", user.id)
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ overall_score: existing.overall_score, cached: true });
    }

    // Load user CV text
    const { data: profile } = await supabase
      .from("profiles")
      .select("cv_raw_text, cv_file_url")
      .eq("user_id", user.id)
      .maybeSingle();

    let cvText = (profile as { cv_raw_text?: string } | null)?.cv_raw_text ?? "";

    // If no raw text but file URL exists, try to extract from storage
    if (!cvText && (profile as { cv_file_url?: string } | null)?.cv_file_url) {
      const fileUrl = (profile as { cv_file_url: string }).cv_file_url;
      const pathMatch = fileUrl.match(/cvs\/(.+)$/);
      if (pathMatch) {
        const { data: fileData } = await supabase.storage.from("cvs").download(pathMatch[1]);
        if (fileData) {
          const buffer = Buffer.from(await fileData.arrayBuffer());
          if (pathMatch[1].endsWith(".txt")) {
            cvText = buffer.toString("utf-8");
          } else {
            try {
              // @ts-expect-error - pdf-parse has no types
              const pdfParse = (await import("pdf-parse")).default;
              const parsed = await pdfParse(buffer);
              cvText = parsed.text?.trim() || "";
            } catch {}
          }
          if (cvText) {
            await supabase.from("profiles").update({ cv_raw_text: cvText }).eq("user_id", user.id);
          }
        }
      }
    }

    if (!cvText || cvText.length < 10) {
      return NextResponse.json(
        { error: "No CV found. Please upload your CV in your profile first." },
        { status: 400 }
      );
    }

    // Load job details
    const { data: job } = await supabase
      .from("job_listings")
      .select("title, company_id, ai_interview_config")
      .eq("id", jobId)
      .maybeSingle();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const jobTitle = (job as { title: string }).title;
    const companyId = (job as { company_id: string }).company_id;

    const config = ((job as { ai_interview_config?: { cv_required_items?: string[] } }).ai_interview_config) ?? {};
    const items = config.cv_required_items?.filter((s) => typeof s === "string" && s.trim()) ?? [];
    let cvRequiredBlock = "";
    if (items.length > 0) {
      cvRequiredBlock = `\nThe employer requires the following in the CV. Score the CV considering presence or absence of these: reward if clearly present, penalize if missing.\n${items.map((s) => `- ${s}`).join("\n")}\n\n`;
    }

    const systemPrompt = `You are a senior HR expert. Score this CV ONLY for fit to "${jobTitle}".
${cvRequiredBlock}
Score each category 0-100. Output ONLY valid JSON:
{"category_scores":{"professional_summary":0,"work_experience":0,"skills":0,"education":0,"online_presence":0,"highlights":0},"strengths":[],"improvements":[]}`;

    const groq = getGroq();
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `TARGET ROLE: "${jobTitle}"\n\nCV text:\n\n${cvText}` },
        ],
      });
    } catch (groqError) {
      logError("cv-analysis/auto Groq failed", groqError);
      return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
    }

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      return NextResponse.json({ error: "No response from model" }, { status: 500 });
    }

    const jsonStr = extractJsonFromText(text);
    let parsed: {
      category_scores?: Record<string, number>;
      strengths?: string[];
      improvements?: string[];
    };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      logError("cv-analysis/auto invalid JSON", { raw: text });
      return NextResponse.json({ error: "Invalid response from model" }, { status: 500 });
    }

    const categoryScores: Record<string, number> = {};
    for (const k of CATEGORY_KEYS) {
      const v = parsed.category_scores?.[k];
      categoryScores[k] = typeof v === "number" && !Number.isNaN(v) ? clampScore(v) : 50;
    }
    const overall_score = computeOverallScore(categoryScores);
    const strengths = Array.isArray(parsed.strengths) ? parsed.strengths.filter((s) => typeof s === "string").slice(0, 5) : [];
    const improvements = Array.isArray(parsed.improvements) ? parsed.improvements.filter((s) => typeof s === "string").slice(0, 5) : [];

    await supabase.from("cv_analyses").insert({
      user_id: user.id,
      job_category: jobTitle,
      job_id: jobId,
      overall_score,
      category_scores: categoryScores,
      strengths,
      improvements,
    });

    // Log to employer_usage_logs (cost is on the employer, not the candidate)
    if (companyId) {
      await supabase.from("employer_usage_logs").insert({
        company_id: companyId,
        feature: "auto_cv_analysis",
      });
    }

    return NextResponse.json({ overall_score, cached: false });
  } catch (e) {
    logError("cv-analysis/auto unexpected error", e);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
