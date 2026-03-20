import { NextRequest, NextResponse } from "next/server";
import { getGroq } from "@/lib/groq";
import { createClient } from "@/lib/supabase/server";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { captureServer } from "@/lib/analytics-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
import { canUseFeature, logUsage, getUserPlan } from "@/lib/usage";
import { getRateLimitIdentifier, rateLimitForKind, tooManyRequestsResponse } from "@/lib/rate-limit";
import { parseJsonBody, parseWithSchema } from "@/lib/api-validation";
import { cvAnalysisJsonBodySchema, cvAnalysisMultipartFieldsSchema } from "@/types/schemas";
import { buildCvAnalysisSystemPrompt, GROQ_JSON_OBJECT_RESPONSE_FORMAT } from "@/lib/ai/prompts";
import { parseCvAnalysisModelOutput } from "@/lib/ai/structured-output";
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

const WEIGHTS: Record<string, number> = {
  professional_summary: 0.15,
  work_experience: 0.3,
  skills: 0.25,
  education: 0.15,
  online_presence: 0.05,
  highlights: 0.1,
};

export async function POST(request: NextRequest) {
  logInfo("cv-analysis request received");
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rlId = getRateLimitIdentifier(request, user.id);
    const limited = await rateLimitForKind("cvAnalysis", rlId);
    if (!limited.success) return tooManyRequestsResponse(limited);

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
      const jobCategoryRaw = formData.get("jobCategory");
      const jobIdRaw = formData.get("jobId");
      const fieldsParsed = parseWithSchema(cvAnalysisMultipartFieldsSchema, {
        jobCategory: typeof jobCategoryRaw === "string" ? jobCategoryRaw : "",
        jobId: typeof jobIdRaw === "string" ? jobIdRaw : undefined,
      });
      if (!fieldsParsed.ok) {
        logWarn("cv-analysis validation failed", { reason: "multipart fields schema" });
        return fieldsParsed.response;
      }
      jobCategory = fieldsParsed.data.jobCategory;
      jobId = fieldsParsed.data.jobId;
      if (!file || !(file instanceof File)) {
        logWarn("cv-analysis validation failed", { reason: "file required" });
        return NextResponse.json(
          {
            error: "Validation failed",
            message: "file is required",
            issues: [
              {
                code: "custom",
                path: ["file"],
                message: "A PDF or TXT file is required",
              },
            ],
          },
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
      const parsed = await parseJsonBody(request, cvAnalysisJsonBodySchema);
      if (!parsed.ok) {
        logWarn("cv-analysis validation failed", { reason: "json body schema" });
        return parsed.response;
      }
      cvText = parsed.data.cvText;
      jobCategory = parsed.data.jobCategory;
      jobId = parsed.data.jobId;
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

    const systemPrompt = buildCvAnalysisSystemPrompt(jobCategory, cvRequiredBlock);

    const groq = getGroq();
    const userContent = `TARGET ROLE FOR THIS EVALUATION: "${jobCategory}"\n\nEvaluate the following CV only for fit to the role above. CV text:\n\n${cvText}`;
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0,
        response_format: GROQ_JSON_OBJECT_RESPONSE_FORMAT,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      });
    } catch (groqError) {
      logError("cv-analysis Groq request failed", groqError);
      await captureServer(user.id, ANALYTICS_EVENTS.cv_analysis_failed, {
        reason: "groq_error",
        job_category: jobCategory,
        ...(jobId && String(jobId).trim() ? { job_id: String(jobId).trim() } : {}),
      });
      return NextResponse.json(
        { error: groqError instanceof Error ? groqError.message : "CV analysis failed" },
        { status: 500 }
      );
    }

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      logError("cv-analysis Groq returned empty content", undefined);
      await captureServer(user.id, ANALYTICS_EVENTS.cv_analysis_failed, {
        reason: "empty_model_response",
        job_category: jobCategory,
        ...(jobId && String(jobId).trim() ? { job_id: String(jobId).trim() } : {}),
      });
      return NextResponse.json({ error: "No response from model" }, { status: 500 });
    }

    const normalized = parseCvAnalysisModelOutput(text, WEIGHTS);
    if (normalized.usedFallback) {
      logWarn("cv-analysis used fallback parser output", { job_category: jobCategory });
    }

    const { usedFallback: _u, ...result } = normalized;

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
      await captureServer(user.id, ANALYTICS_EVENTS.cv_analysis_failed, {
        reason: "db_insert",
        job_category: jobCategory,
        ...(jobId && String(jobId).trim() ? { job_id: String(jobId).trim() } : {}),
      });
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await logUsage(supabase, user.id, "cv_analysis");

    await captureServer(user.id, ANALYTICS_EVENTS.cv_analysis_completed, {
      source: "manual",
      job_category: jobCategory,
      overall_score: result.overall_score,
      ...(jobId && String(jobId).trim() ? { job_id: String(jobId).trim() } : {}),
    });

    return NextResponse.json(result);
  } catch (e) {
    logError("cv-analysis unexpected error", e);
    try {
      const supabase = await createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u?.id) {
        await captureServer(u.id, ANALYTICS_EVENTS.cv_analysis_failed, { reason: "unexpected" });
      }
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : "CV analysis failed";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
