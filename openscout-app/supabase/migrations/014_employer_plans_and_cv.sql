-- CV storage on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cv_file_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cv_raw_text TEXT;

-- Employer profile enhancements
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_title_at_company TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website TEXT;

-- Employer plans (trial | growth | scale)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'trial';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS total_application_limit INT DEFAULT 50;

-- Backfill: existing subscribed companies get 'growth'
UPDATE companies SET plan = 'growth', total_application_limit = 50
  WHERE stripe_subscription_status = 'active' AND (plan IS NULL OR plan = 'trial');

-- Employer usage tracking (auto CV analyses, etc.)
CREATE TABLE IF NOT EXISTS employer_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE employer_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS: company owners can read their own usage logs
CREATE POLICY "Company owners can view usage logs"
  ON employer_usage_logs FOR SELECT
  USING (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
  );

-- Supabase Storage bucket for CVs (run via dashboard or supabase CLI)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('cvs', 'cvs', false) ON CONFLICT DO NOTHING;
