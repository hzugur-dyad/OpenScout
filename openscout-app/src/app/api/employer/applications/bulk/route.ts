import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseJsonBody } from "@/lib/api-validation";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { captureException } from "@/lib/monitoring";
import { enforceRateLimit } from "@/lib/rate-limit";
import { userCanRecruitForCompany } from "@/lib/employer-company";

const bulkSchema = z.object({
  jobId: z.string().trim().min(1),
  applicationIds: z.array(z.string().trim().min(1)).min(1).max(100),
  status: z.enum([
    "applied",
    "screening",
    "shortlisted",
    "interviewing",
    "offer",
    "hired",
    "rejected",
  ]),
});

export async function POST(request: NextRequest) {
  logInfo("employer applications bulk POST received");
  try {
    const parsed = await parseJsonBody(request, bulkSchema);
    if (!parsed.ok) return parsed.response;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rateLimited = await enforceRateLimit(request, user.id, {
      namespace: "employer-applications-bulk",
      preset: "moderate",
    });
    if (rateLimited) return rateLimited;

    const { jobId, applicationIds, status } = parsed.data;

    const { data: job } = await supabase
      .from("job_listings")
      .select("id, company_id")
      .eq("id", jobId)
      .maybeSingle();
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const companyId = (job as { company_id: string }).company_id;
    const { data: company } = await supabase
      .from("companies")
      .select("stripe_subscription_status")
      .eq("id", companyId)
      .maybeSingle();
    const subscribed =
      (company as { stripe_subscription_status?: string } | null)?.stripe_subscription_status === "active";
    const canRecruit = await userCanRecruitForCompany(supabase, user.id, companyId);
    if (!subscribed || !canRecruit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: rows } = await supabase
      .from("job_applications")
      .select("id, application_status")
      .eq("job_id", jobId)
      .in("id", applicationIds);

    const validRows = (rows ?? []) as { id: string; application_status: string }[];
    if (validRows.length !== applicationIds.length) {
      return NextResponse.json({ error: "One or more applications are not on this job" }, { status: 400 });
    }

    const now = new Date().toISOString();
    for (const row of validRows) {
      if (row.application_status === status) continue;
      const { error: uErr } = await supabase
        .from("job_applications")
        .update({ application_status: status, updated_at: now })
        .eq("id", row.id);
      if (uErr) {
        logError("employer bulk status update failed", uErr);
        return NextResponse.json({ error: uErr.message }, { status: 500 });
      }
      const { error: evErr } = await supabase.from("application_events").insert({
        job_application_id: row.id,
        actor_user_id: user.id,
        event_type: "bulk_status_change",
        old_status: row.application_status,
        new_status: status,
      });
      if (evErr) logWarn("employer bulk event insert failed", { message: evErr.message });
    }

    return NextResponse.json({ ok: true, updated: validRows.length });
  } catch (e) {
    logError("employer applications bulk unexpected error", e);
    captureException(e, { route: "/api/employer/applications/bulk" });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
