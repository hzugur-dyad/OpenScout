import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { ScoutPassData } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const limited = await enforceRateLimit(request, null, {
      namespace: "scout-pass-public",
      preset: "lenient",
    });
    if (limited) return limited;

    const { slug } = await params;
    if (!slug?.trim()) {
      return NextResponse.json({ error: "Slug required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: credential, error } = await supabase
      .from("scout_credentials")
      .select("user_id, job_category, cv_score, interview_score, report, created_at")
      .eq("public_slug", slug.trim())
      .maybeSingle();

    if (error) {
      console.error("scout_pass fetch error:", error);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!credential) {
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json(
          { error: "Scout Pass links are temporarily unavailable. Please try again later." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let displayName: string | null = null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("user_id", (credential as { user_id: string }).user_id)
      .maybeSingle();
    if (profile) {
      displayName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || null;
    }

    const payload: ScoutPassData = {
      job_category: credential.job_category,
      cv_score: credential.cv_score,
      interview_score: credential.interview_score,
      report: credential.report ?? {},
      created_at: credential.created_at,
      display_name: displayName,
    };
    return NextResponse.json(payload);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
