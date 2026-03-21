import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { ReferralMyCodeResponse } from "@/lib/types";
import { captureException } from "@/lib/monitoring";

function generateCode(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const limited = await enforceRateLimit(request, user?.id, {
      namespace: "referral-my-code",
      preset: "lenient",
    });
    if (limited) return limited;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [{ data: existing }, { data: profile }, referredRes, rewardedRes] = await Promise.all([
      supabase.from("referral_codes").select("code").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("bonus_mock_interview_credits").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_user_id", user.id),
      supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_user_id", user.id)
        .eq("reward_status", "rewarded"),
    ]);

    const referredCount = referredRes.count ?? 0;
    const successfulReferralsCount = rewardedRes.count ?? 0;
    const bonusInterviewCreditsBalance = Math.max(
      0,
      Number((profile as { bonus_mock_interview_credits?: number } | null)?.bonus_mock_interview_credits) || 0
    );

    const withMeta = (code: string): ReferralMyCodeResponse => ({
      code,
      referredCount,
      successfulReferralsCount,
      bonusInterviewCreditsBalance,
    });

    if (existing) {
      return NextResponse.json(withMeta(existing.code));
    }

    let code = generateCode();
    let attempts = 0;
    while (attempts < 5) {
      const { error } = await supabase.from("referral_codes").insert({
        user_id: user.id,
        code,
      });
      if (!error) {
        return NextResponse.json(withMeta(code));
      }
      if (error.code === "23505") {
        code = generateCode();
        attempts++;
        continue;
      }
      throw error;
    }

    return NextResponse.json({ error: "Could not create code" }, { status: 500 });
  } catch (e) {
    captureException(e, { route: "/api/referral/my-code" });
    return NextResponse.json({ error: "Failed to get referral code" }, { status: 500 });
  }
}
