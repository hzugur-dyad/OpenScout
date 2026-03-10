-- Scout credentials: one per user per job category (shareable "Scout Score" / "OpenScout Pass")
CREATE TABLE scout_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  job_category TEXT NOT NULL,
  public_slug TEXT UNIQUE NOT NULL,
  cv_score INT,
  interview_score INT,
  report JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_category)
);

CREATE INDEX idx_scout_credentials_public_slug ON scout_credentials(public_slug);

ALTER TABLE scout_credentials ENABLE ROW LEVEL SECURITY;

-- Users can manage their own credentials
CREATE POLICY "Users can manage own scout_credentials" ON scout_credentials
  FOR ALL USING (auth.uid() = user_id);

-- Public read by slug is done via API using service role (no policy for anonymous)
