import { NextRequest, NextResponse } from "next/server";
import { getGroq } from "@/lib/groq";
import { createClient } from "@/lib/supabase/server";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { canUseFeature, logUsage, getUserPlan } from "@/lib/usage";
// @ts-expect-error - pdf-parse has no types
import pdfParse from "pdf-parse";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function isAllowedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === "application/pdf" ||
    name.endsWith(".pdf") ||
    file.type === "text/plain" ||
    name.endsWith(".txt")
  );
}

async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("File size exceeds 10MB limit");
  }
  if (!isAllowedFile(file)) {
    throw new Error("Only PDF and TXT files are supported. DOC/DOCX are not supported.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const data = await pdfParse(buffer);
    return data.text?.trim() || "";
  }
  return buffer.toString("utf-8");
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

export async function POST(request: NextRequest) {
  logInfo("cv-analysis request received");
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle();
    const plan = getUserPlan(profile?.plan);
    const { allowed, used, limit } = await canUseFeature(supabase, user.id, "cv_analysis", plan);
    if (!allowed) {
      return NextResponse.json(
        { error: "Weekly CV analysis limit reached. Upgrade your plan for more.", used, limit },
        { status: 403 }
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let cvText: string;
    let jobCategory: string;

    let jobId: string | undefined;
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      jobCategory = (formData.get("jobCategory") as string) || "";
      jobId = (formData.get("jobId") as string) || undefined;
      if (!file || !jobCategory) {
        logWarn("cv-analysis validation failed", { reason: "file and job category required" });
        return NextResponse.json(
          { error: "File and job category are required" },
          { status: 400 }
        );
      }
      if (!isAllowedFile(file)) {
        logWarn("cv-analysis validation failed", { reason: "invalid file type" });
        return NextResponse.json(
          { error: "Only PDF and TXT files are supported. DOC/DOCX are not supported." },
          { status: 400 }
        );
      }
      cvText = await extractTextFromFile(file);
      if (!cvText || cvText.length < 10) {
        logWarn("cv-analysis validation failed", { reason: "no readable text extracted" });
        return NextResponse.json(
          { error: "Could not extract readable text from the file. Please ensure the PDF is not scanned/image-based." },
          { status: 400 }
        );
      }
    } else {
      const body = await request.json();
      cvText = body.cvText;
      jobCategory = body.jobCategory;
      jobId = body.jobId;
      if (!cvText || !jobCategory) {
        logWarn("cv-analysis validation failed", { reason: "cvText and jobCategory required" });
        return NextResponse.json(
          { error: "cvText and jobCategory are required" },
          { status: 400 }
        );
      }
    }

    let cvRequiredBlock = "";
    if (jobId && typeof jobId === "string") {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data: job } = await supabase
        .from("job_listings")
        .select("ai_interview_config")
        .eq("id", jobId.trim())
        .maybeSingle();
      const config = (job?.ai_interview_config as { cv_required_items?: string[] } | null) ?? {};
      const items = config.cv_required_items?.filter((s) => typeof s === "string" && s.trim()) ?? [];
      if (items.length > 0) {
        cvRequiredBlock = `\nThe employer requires the following in the CV. Score the CV considering presence or absence of these: reward if clearly present, penalize if missing.\n${items.map((s) => `- ${s}`).join("\n")}\n\n`;
      }
    }

    const systemPrompt = `You are a senior HR and recruitment expert (15+ years). The user has selected a TARGET ROLE for this CV evaluation. You must score the CV ONLY for fit to that role.

TARGET ROLE (evaluate ONLY for this): "${jobCategory}"
${cvRequiredBlock}
CRITICAL RULES:
- Score = how well this CV fits "${jobCategory}", not how good the CV is in general.
- If the candidate's experience/skills are in a DIFFERENT area (e.g. Mobile Developer, Backend, Data) and do NOT show clear relevance to "${jobCategory}", score work_experience and skills LOW (e.g. 20-50). Do NOT give high scores for strong experience in an unrelated role.
- "Relevant" always means relevant to "${jobCategory}". Unrelated experience does not count.
- Be objective, evidence-based, and consistent: the same CV must get the same scores. Base every score on explicit evidence from the CV text.

STEP 1 – Extract cv_holder from the CV text (name, current role, department/field, location, email if present, one-sentence summary).

STEP 2 – Score each category 0-100 for FIT TO "${jobCategory}" using ONLY the rubric below.

STRICT SCORING RUBRIC (scores are for fit to "${jobCategory}" only):

professional_summary:
- 85-100: Summary is clearly tailored to ${jobCategory}; mentions this role/field; specific achievements relevant to it. Low if it targets a different role (e.g. mobile when category is frontend).
- 70-84: Good alignment to ${jobCategory}; some specifics.
- 50-69: Generic or weakly aligned to ${jobCategory}.
- 30-49: Aimed at another role or vague.
- 0-29: Missing, or clearly for a different role than ${jobCategory}.

work_experience:
- 85-100: Experience is directly in ${jobCategory} or closely related; roles and results clearly match. If experience is in another field (e.g. only mobile, only backend) and not ${jobCategory}, score 20-50.
- 70-84: Mostly relevant to ${jobCategory}; minor gaps.
- 50-69: Some overlap with ${jobCategory} but not primary focus.
- 30-49: Mostly unrelated to ${jobCategory}; little or no direct experience in this role.
- 0-29: No experience relevant to ${jobCategory}, or missing.

skills:
- 85-100: Skills and tools listed are those required for ${jobCategory}; evidence in CV. If skills are for a different role (e.g. Swift/Kotlin for mobile only, no frontend), score low for Frontend Developer.
- 70-84: Good match to ${jobCategory} requirements.
- 50-69: Partial match; some relevant, some not.
- 30-49: Mostly skills for another role; weak match to ${jobCategory}.
- 0-29: No skills relevant to ${jobCategory}, or missing.

education:
- 85-100: Education directly relevant to ${jobCategory}; cite degree and institution.
- 70-84: Relevant to ${jobCategory} with minor gaps.
- 50-69: Related field or older.
- 30-49: Weak relevance to ${jobCategory}.
- 0-29: No education relevant to ${jobCategory}, or missing.

online_presence:
- 85-100: LinkedIn/portfolio/GitHub mentioned and relevant to ${jobCategory}.
- 70-84: At least one relevant link.
- 50-69: Mentioned but not clearly tied to ${jobCategory}.
- 30-49: Vague or absent.
- 0-29: Not mentioned.

highlights:
- 85-100: Achievements and metrics clearly relevant to ${jobCategory}. Cite at least one.
- 70-84: Good highlights relevant to ${jobCategory}.
- 50-69: Some highlights but not clearly for ${jobCategory}.
- 30-49: Few or not role-relevant.
- 0-29: None or irrelevant to ${jobCategory}.

STEP 3 – For each category, write category_feedback: 2-4 sentences. State how the CV content relates (or does not relate) to "${jobCategory}". Cite specific parts of the CV. If experience/skills are in a different area, say so and explain the low score.

STEP 4 – Write detailed_report: one paragraph (4-8 sentences) for a hiring manager. Start by stating whether the CV is a strong, partial, or weak fit for "${jobCategory}". If the candidate's background is in another role (e.g. mobile, backend), say so and explain the impact on the score. Then summarise key evidence from the CV and main gaps relative to ${jobCategory}.

STEP 5 – strengths: 3-5 items that are relevant to "${jobCategory}" (only list strengths that help for this role). Reference the CV explicitly. English.
STEP 6 – improvements: 3-5 actionable items. Focus on what is missing or weak for "${jobCategory}" (e.g. "Add frontend technologies like React if targeting Frontend Developer"). English.

Output ONLY valid JSON, no markdown or explanation:
{"cv_holder":{"full_name":"","current_role":"","department_or_field":"","location":"","email":"","summary_line":""},"category_scores":{"professional_summary":0,"work_experience":0,"skills":0,"education":0,"online_presence":0,"highlights":0},"category_feedback":{"professional_summary":"","work_experience":"","skills":"","education":"","online_presence":"","highlights":""},"detailed_report":"","strengths":[],"improvements":[]}
Use the exact keys above. All strings must be non-empty where applicable. Scores integers 0-100. Return only this JSON.`;

    const groq = getGroq();
    const userContent = `TARGET ROLE FOR THIS EVALUATION: "${jobCategory}"\n\nEvaluate the following CV only for fit to the role above. CV text:\n\n${cvText}`;
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      });
    } catch (groqError) {
      logError("cv-analysis Groq request failed", groqError);
      return NextResponse.json(
        { error: groqError instanceof Error ? groqError.message : "CV analysis failed" },
        { status: 500 }
      );
    }

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      logError("cv-analysis Groq returned empty content", undefined);
      throw new Error("No response from model");
    }

    const jsonStr = extractJsonFromText(text);
    let parsed: {
      cv_holder?: {
        full_name?: string;
        current_role?: string;
        department_or_field?: string;
        location?: string;
        email?: string;
        summary_line?: string;
      };
      overall_score?: number;
      category_scores?: Record<string, number>;
      category_feedback?: Record<string, string>;
      detailed_report?: string;
      strengths?: string[];
      improvements?: string[];
    };
    try {
      parsed = JSON.parse(jsonStr) as typeof parsed;
    } catch (e) {
      logError("cv-analysis invalid JSON from model", e);
      return NextResponse.json(
        { error: "Invalid JSON from model" },
        { status: 500 }
      );
    }

    const h = parsed.cv_holder ?? {};
    const cv_holder = {
      full_name: typeof h.full_name === "string" ? h.full_name.trim() : "",
      current_role: typeof h.current_role === "string" ? h.current_role.trim() : "",
      department_or_field: typeof h.department_or_field === "string" ? h.department_or_field.trim() : "",
      location: typeof h.location === "string" ? h.location.trim() : "",
      email: typeof h.email === "string" ? h.email.trim() : "",
      summary_line: typeof h.summary_line === "string" ? h.summary_line.trim() : "",
    };

    const categoryScores: Record<string, number> = {};
    for (const k of CATEGORY_KEYS) {
      const v = parsed.category_scores?.[k];
      categoryScores[k] = typeof v === "number" && !Number.isNaN(v) ? clampScore(v) : 50;
    }
    const overall_score = computeOverallScore(categoryScores);
    const strengths = Array.isArray(parsed.strengths) ? parsed.strengths.filter((s) => typeof s === "string").slice(0, 5) : [];
    const improvements = Array.isArray(parsed.improvements) ? parsed.improvements.filter((s) => typeof s === "string").slice(0, 5) : [];

    const category_feedback: Record<string, string> = {};
    for (const k of CATEGORY_KEYS) {
      const v = parsed.category_feedback?.[k];
      category_feedback[k] = typeof v === "string" ? v.trim() : "";
    }
    const detailed_report = typeof parsed.detailed_report === "string" ? parsed.detailed_report.trim() : "";

    const result = {
      cv_holder,
      overall_score,
      category_scores: categoryScores,
      category_feedback,
      detailed_report,
      strengths,
      improvements,
    };

    const { error: insertError } = await supabase.from("cv_analyses").insert({
      user_id: user.id,
      job_category: jobCategory,
      ...(jobId && jobId.trim() ? { job_id: jobId.trim() } : {}),
      overall_score: result.overall_score,
      category_scores: result.category_scores || {},
      strengths: result.strengths || [],
      improvements: result.improvements || [],
    });

    if (insertError) {
      logError("cv-analysis insert failed", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await logUsage(supabase, user.id, "cv_analysis");

    return NextResponse.json(result);
  } catch (e) {
    logError("cv-analysis unexpected error", e);
    const msg = e instanceof Error ? e.message : "CV analysis failed";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
