import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRateLimitIdentifier, rateLimitForKind, tooManyRequestsResponse } from "@/lib/rate-limit";
import type { ReferralAttributeBody } from "@/lib/types";
import { captureServer } from "@/lib/analytics-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
import { captureException } from "@/lib/monitoring";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const rlId = getRateLimitIdentifier(request, user?.id);
    const limited = await rateLimitForKind("referralAttribute", rlId);
    if (!limited.success) return tooManyRequestsResponse(limited);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Partial<ReferralAttributeBody>;
    const code = typeof body.code === "string" ? body.code.trim().toLowerCase() : "";
    if (!code) {
      return NextResponse.json({ error: "code required" }, { status: 400 });
    }

    const { data: codeRow } = await supabase
      .from("referral_codes")
      .select("user_id")
      .eq("code", code)
      .maybeSingle();

    if (!codeRow || (codeRow as { user_id: string }).user_id === user.id) {
      return NextResponse.json({ error: "Invalid or self-referral" }, { status: 400 });
    }

    const referrerUserId = (codeRow as { user_id: string }).user_id;

    const { data: existing } = await supabase
      .from("referrals")
      .select("referrer_user_id")
      .eq("referred_user_id", user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase.from("referrals").insert({
      referrer_user_id: referrerUserId,
      referred_user_id: user.id,
    });

    if (error) {
      if (error.code === "23505") return NextResponse.json({ ok: true });
      console.error("referral attribute error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await captureServer(user.id, ANALYTICS_EVENTS.referral_attributed, {});

    return NextResponse.json({ ok: true });
  } catch (e) {
    captureException(e, { route: "/api/referral/attribute" });
    return NextResponse.json({ error: "Failed to attribute referral" }, { status: 500 });
  }
}
