import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ScoutCredentialCreateBody, ScoutCredentialResponse } from "@/lib/types";

function generateSlug(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Partial<ScoutCredentialCreateBody>;
    const jobCategory = typeof body.jobCategory === "string" ? body.jobCategory.trim() : "";
    let cvScore = typeof body.cvScore === "number" ? body.cvScore : null;

    if (!jobCategory) {
      return NextResponse.json({ error: "jobCategory is required" }, { status: 400 });
    }

    const { data: latestInterview } = await supabase
      .from("mock_interviews")
      .select("score, report")
      .eq("user_id", user.id)
      .eq("job_category", jobCategory)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestInterview) {
      return NextResponse.json(
        { error: "Complete a mock interview for this category before creating a Scout credential." },
        { status: 400 }
      );
    }

    const interviewScore = typeof (latestInterview as { score: number | null }).score === "number"
      ? (latestInterview as { score: number }).score
      : null;
    const report = (latestInterview as { report?: { strengths?: unknown[]; improvements?: unknown[] } }).report ?? {};
    const strengths = Array.isArray(report.strengths) ? report.strengths : [];
    const improvements = Array.isArray(report.improvements) ? report.improvements : [];

    if (cvScore === null) {
      const { data: latestCv } = await supabase
        .from("cv_analyses")
        .select("overall_score")
        .eq("user_id", user.id)
        .eq("job_category", jobCategory)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      cvScore = latestCv?.overall_score ?? null;
    }

    const { data: existing } = await supabase
      .from("scout_credentials")
      .select("id, public_slug")
      .eq("user_id", user.id)
      .eq("job_category", jobCategory)
      .maybeSingle();

    const publicSlug = existing?.public_slug ?? generateSlug();
    const payload = {
      user_id: user.id,
      job_category: jobCategory,
      public_slug: publicSlug,
      cv_score: cvScore,
      interview_score: interviewScore,
      report: { strengths, improvements },
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("scout_credentials").upsert(payload, {
      onConflict: "user_id,job_category",
    });

    if (error) {
      console.error("scout_credential upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin || "";
    const passUrl = `${baseUrl.replace(/\/$/, "")}/pass/${publicSlug}`;

    const response: ScoutCredentialResponse = { slug: publicSlug, passUrl };
    return NextResponse.json(response);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create Scout credential" }, { status: 500 });
  }
}
