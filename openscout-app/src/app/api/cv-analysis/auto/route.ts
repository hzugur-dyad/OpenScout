import { NextRequest, NextResponse } from "next/server";
import { getGroq } from "@/lib/groq";
import { createClient } from "@/lib/supabase/server";
import { logError, logInfo } from "@/lib/logger";
import { getRateLimitIdentifier, rateLimitForKind, tooManyRequestsResponse } from "@/lib/rate-limit";
import { captureServer } from "@/lib/analytics-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
import { buildCvAnalysisAutoSystemPrompt, GROQ_JSON_OBJECT_RESPONSE_FORMAT } from "@/lib/ai/prompts";
import { parseAutoCvAnalysisModelOutput } from "@/lib/ai/structured-output";

const WEIGHTS: Record<string, number> = {
  professional_summary: 0.15,
  work_experience: 0.3,
  skills: 0.25,
  education: 0.15,
  online_presence: 0.05,
  highlights: 0.1,
};

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

    const rlId = getRateLimitIdentifier(request, user.id);
    const limited = await rateLimitForKind("cvAnalysis", rlId);
    if (!limited.success) return tooManyRequestsResponse(limited);

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
      await captureServer(user.id, ANALYTICS_EVENTS.cv_analysis_completed, {
        source: "auto",
        job_id: jobId,
        cached: true,
        overall_score: existing.overall_score,
      });
      return NextResponse.json({ overall_score: existing.overall_score, cached: true });
    }

    // Load user CV text
    const { data: privateRow } = await supabase
      .from("profile_private")
      .select("cv_raw_text, cv_file_url")
      .eq("user_id", user.id)
      .maybeSingle();

    let cvText = (privateRow as { cv_raw_text?: string } | null)?.cv_raw_text ?? "";

    // If no raw text but file URL exists, try to extract from storage
    if (!cvText && (privateRow as { cv_file_url?: string } | null)?.cv_file_url) {
      const fileUrl = (privateRow as { cv_file_url: string }).cv_file_url;
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
            await supabase
              .from("profile_private")
              .upsert(
                {
                  user_id: user.id,
                  cv_raw_text: cvText,
                  cv_file_url: fileUrl,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id" }
              );
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

    const systemPrompt = buildCvAnalysisAutoSystemPrompt(jobTitle, cvRequiredBlock);

    const groq = getGroq();
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0,
        response_format: GROQ_JSON_OBJECT_RESPONSE_FORMAT,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `TARGET ROLE: "${jobTitle}"\n\nCV text:\n\n${cvText}` },
        ],
      });
    } catch (groqError) {
      logError("cv-analysis/auto Groq failed", groqError);
      await captureServer(user.id, ANALYTICS_EVENTS.cv_analysis_failed, {
        reason: "groq_error",
        source: "auto",
        job_id: jobId,
      });
      return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
    }

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      await captureServer(user.id, ANALYTICS_EVENTS.cv_analysis_failed, {
        reason: "empty_model_response",
        source: "auto",
        job_id: jobId,
      });
      return NextResponse.json({ error: "No response from model" }, { status: 500 });
    }

    const normalized = parseAutoCvAnalysisModelOutput(text, WEIGHTS);
    if (normalized.usedFallback) {
      logError("cv-analysis/auto model parse fallback", { job_id: jobId, preview: text.slice(0, 200) });
    }

    const categoryScores = normalized.category_scores;
    const overall_score = normalized.overall_score;
    const strengths = normalized.strengths;
    const improvements = normalized.improvements;

    const { error: insertErr } = await supabase.from("cv_analyses").insert({
      user_id: user.id,
      job_category: jobTitle,
      job_id: jobId,
      overall_score,
      category_scores: categoryScores,
      strengths,
      improvements,
    });
    if (insertErr) {
      logError("cv-analysis/auto insert failed", insertErr);
      await captureServer(user.id, ANALYTICS_EVENTS.cv_analysis_failed, {
        reason: "db_insert",
        source: "auto",
        job_id: jobId,
      });
      return NextResponse.json({ error: "Could not save analysis" }, { status: 500 });
    }

    await captureServer(user.id, ANALYTICS_EVENTS.cv_analysis_completed, {
      source: "auto",
      job_id: jobId,
      job_category: jobTitle,
      overall_score,
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
    try {
      const supabase = await createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u?.id) {
        await captureServer(u.id, ANALYTICS_EVENTS.cv_analysis_failed, {
          reason: "unexpected",
          source: "auto",
        });
      }
    } catch {
      /* ignore */
    }
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
