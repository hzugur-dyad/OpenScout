-- Add candidate subscription plan to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_plan_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free', 'plus', 'pro'));
  END IF;
END $$;

-- Weekly usage tracking for CV analysis and mock interviews
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK (feature IN ('cv_analysis', 'mock_interview')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_feature ON usage_logs(user_id, feature, created_at);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own usage" ON usage_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own usage" ON usage_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add sector to companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS sector TEXT;

-- Add trial tracking to companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;

-- Backfill trial_started_at for existing companies
UPDATE companies SET trial_started_at = created_at WHERE trial_started_at IS NULL;
