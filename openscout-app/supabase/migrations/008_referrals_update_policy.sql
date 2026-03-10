-- Allow referred user to update their referral row (so attribute API upsert works on second call)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'referrals' AND policyname = 'Referred user can update own referral row'
  ) THEN
    CREATE POLICY "Referred user can update own referral row" ON referrals
      FOR UPDATE USING (auth.uid() = referred_user_id);
  END IF;
END $$;
