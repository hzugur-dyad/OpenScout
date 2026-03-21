-- Referral rewards: onboarding timestamp, bonus mock-interview credits, referral lifecycle status

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bonus_mock_interview_credits INT NOT NULL DEFAULT 0;

DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_bonus_mock_interview_credits_non_negative
    CHECK (bonus_mock_interview_credits >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS reward_status TEXT NOT NULL DEFAULT 'attributed',
  ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rewarded_at TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE public.referrals
    ADD CONSTRAINT referrals_reward_status_check
    CHECK (reward_status IN ('attributed', 'qualified', 'rewarded'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_referrals_reward_status ON public.referrals (referrer_user_id, reward_status);

-- Atomic, idempotent reward grant (service_role only). Prevents double payout via row lock + status transition.
CREATE OR REPLACE FUNCTION public.try_complete_referral_reward(p_referred_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_onboarding TIMESTAMPTZ;
  v_valid BOOLEAN;
  v_final INT;
BEGIN
  SELECT * INTO r FROM public.referrals WHERE referred_user_id = p_referred_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_referral');
  END IF;

  IF r.referrer_user_id = r.referred_user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
  END IF;

  IF r.reward_status = 'rewarded' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_rewarded');
  END IF;

  SELECT onboarding_completed_at INTO v_onboarding FROM public.profiles WHERE user_id = p_referred_user_id;
  IF v_onboarding IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'onboarding_incomplete');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.mock_interviews
    WHERE user_id = p_referred_user_id
      AND length(trim(coalesce(transcript, ''))) >= 400
  ) INTO v_valid;

  IF NOT v_valid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_valid_interview');
  END IF;

  UPDATE public.referrals
  SET
    reward_status = 'qualified',
    qualified_at = COALESCE(qualified_at, now())
  WHERE id = r.id AND reward_status = 'attributed';

  UPDATE public.referrals
  SET
    reward_status = 'rewarded',
    rewarded_at = now()
  WHERE id = r.id AND reward_status = 'qualified';
  GET DIAGNOSTICS v_final = ROW_COUNT;

  IF v_final <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'state_conflict');
  END IF;

  UPDATE public.profiles
  SET bonus_mock_interview_credits = bonus_mock_interview_credits + 1
  WHERE user_id = r.referrer_user_id;

  UPDATE public.profiles
  SET bonus_mock_interview_credits = bonus_mock_interview_credits + 1
  WHERE user_id = p_referred_user_id;

  RETURN jsonb_build_object('ok', true, 'referrer_user_id', r.referrer_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.try_complete_referral_reward(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_complete_referral_reward(UUID) TO service_role;
