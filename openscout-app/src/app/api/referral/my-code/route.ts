import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ReferralMyCodeResponse } from "@/lib/types";

function generateCode(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: existing } = await supabase
      .from("referral_codes")
      .select("code")
      .eq("user_id", user.id)
      .maybeSingle();

    const { count: referredCount } = await supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_user_id", user.id);

    const withCount = (code: string): ReferralMyCodeResponse =>
      ({ code, referredCount: referredCount ?? 0 });

    if (existing) {
      return NextResponse.json(withCount(existing.code));
    }

    let code = generateCode();
    let attempts = 0;
    while (attempts < 5) {
      const { error } = await supabase.from("referral_codes").insert({
        user_id: user.id,
        code,
      });
      if (!error) {
        return NextResponse.json(withCount(code));
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
    console.error("referral my-code error:", e);
    return NextResponse.json({ error: "Failed to get referral code" }, { status: 500 });
  }
}
