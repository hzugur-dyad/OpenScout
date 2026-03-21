import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseJsonBody } from "@/lib/api-validation";
import { employerApplicationPatchSchema } from "@/types/schemas";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { captureException } from "@/lib/monitoring";
import { enforceRateLimit } from "@/lib/rate-limit";
import { userCanRecruitForCompany } from "@/lib/employer-company";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> }
) {
  logInfo("employer application PATCH received");
  try {
    const { applicationId } = await context.params;
    if (!applicationId?.trim()) {
      return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
    }

    const parsed = await parseJsonBody(request, employerApplicationPatchSchema);
    if (!parsed.ok) return parsed.response;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimited = await enforceRateLimit(request, user.id, {
      namespace: "employer-application-patch",
      preset: "moderate",
    });
    if (rateLimited) return rateLimited;

    const { data: application } = await supabase
      .from("job_applications")
      .select("id, job_id, application_status, notes")
      .eq("id", applicationId.trim())
      .maybeSingle();

    if (!application) {
      logWarn("employer application PATCH not found", { applicationId });
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const jobId = (application as { job_id: string }).job_id;
    const { data: job } = await supabase
      .from("job_listings")
      .select("id, company_id")
      .eq("id", jobId)
      .maybeSingle();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const companyId = (job as { company_id: string }).company_id;
    const { data: company } = await supabase
      .from("companies")
      .select("user_id, stripe_subscription_status")
      .eq("id", companyId)
      .maybeSingle();

    const subscribed = (company as { stripe_subscription_status?: string } | null)?.stripe_subscription_status === "active";
    const canRecruit = await userCanRecruitForCompany(supabase, user.id, companyId);

    if (!company || !subscribed || !canRecruit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const prevStatus = (application as { application_status?: string }).application_status ?? "applied";
    const prevNotes = (application as { notes?: string | null }).notes ?? "";

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (parsed.data.status !== undefined) {
      updates.application_status = parsed.data.status;
    }
    if (parsed.data.notes !== undefined) {
      updates.notes = parsed.data.notes;
    }

    const { error } = await supabase.from("job_applications").update(updates).eq("id", applicationId.trim());

    if (error) {
      logError("employer application PATCH update failed", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (parsed.data.status !== undefined && parsed.data.status !== prevStatus) {
      const { error: evErr } = await supabase.from("application_events").insert({
        job_application_id: applicationId.trim(),
        actor_user_id: user.id,
        event_type: "status_change",
        old_status: prevStatus,
        new_status: parsed.data.status,
      });
      if (evErr) logWarn("employer application event insert failed", { message: evErr.message });
    }

    if (parsed.data.notes !== undefined && parsed.data.notes !== prevNotes) {
      const excerpt = parsed.data.notes.trim().slice(0, 240);
      const { error: nErr } = await supabase.from("application_events").insert({
        job_application_id: applicationId.trim(),
        actor_user_id: user.id,
        event_type: "note_update",
        note_excerpt: excerpt || null,
      });
      if (nErr) logWarn("employer application note event insert failed", { message: nErr.message });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    logError("employer application PATCH unexpected error", e);
    captureException(e, { route: "/api/employer/applications/[applicationId]" });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
