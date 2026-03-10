-- Link cv_analyses and mock_interviews to specific job for accurate application matching
ALTER TABLE cv_analyses
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES job_listings(id) ON DELETE SET NULL;

ALTER TABLE mock_interviews
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES job_listings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cv_analyses_job_id ON cv_analyses(job_id);
CREATE INDEX IF NOT EXISTS idx_mock_interviews_job_id ON mock_interviews(job_id);
