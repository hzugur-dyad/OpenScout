import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { captureServer } from "@/lib/analytics-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics";

export const REFERRAL_QUALIFYING_TRANSCRIPT_MIN_CHARS = 400;

export type ReferralRewardRpcResult = {
  ok: boolean;
  reason?: string;
  referrer_user_id?: string;
};

/**
 * Runs idempotent referral reward logic for a referred candidate (admin client + SECURITY DEFINER RPC).
 * Safe to call after onboarding save and after a qualifying mock interview result is persisted.
 */
export async function tryCompleteReferralRewardForUser(referredUserId: string): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("try_complete_referral_reward", {
    p_referred_user_id: referredUserId,
  });

  if (error) {
    console.error("try_complete_referral_reward RPC error:", error);
    return;
  }

  const result = data as ReferralRewardRpcResult | null;
  if (!result?.ok || !result.referrer_user_id) {
    return;
  }

  await captureServer(referredUserId, ANALYTICS_EVENTS.referral_qualified, {});
  await captureServer(referredUserId, ANALYTICS_EVENTS.referral_rewarded, {
    role: "referred",
    bonus_credits: 1,
  });
  await captureServer(result.referrer_user_id, ANALYTICS_EVENTS.referral_rewarded, {
    role: "referrer",
    bonus_credits: 1,
  });
}
