import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { tryCompleteReferralRewardForUser } from "@/lib/referral-rewards";
import { captureException } from "@/lib/monitoring";

/**
 * Re-run referral reward eligibility after onboarding (or any client refresh).
 * Idempotent; safe to call multiple times.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const limited = await enforceRateLimit(request, user?.id, {
      namespace: "referral-evaluate",
      preset: "lenient",
    });
    if (limited) return limited;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await tryCompleteReferralRewardForUser(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    captureException(e, { route: "/api/referral/evaluate" });
    return NextResponse.json({ error: "Failed to evaluate referral" }, { status: 500 });
  }
}
