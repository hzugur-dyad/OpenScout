-- Full transcript, language, and audit fields for mock interviews
ALTER TABLE public.mock_interviews
  ADD COLUMN IF NOT EXISTS transcript TEXT,
  ADD COLUMN IF NOT EXISTS interview_language TEXT,
  ADD COLUMN IF NOT EXISTS model_version TEXT,
  ADD COLUMN IF NOT EXISTS prompt_version TEXT;

COMMENT ON COLUMN public.mock_interviews.transcript IS 'Full user+assistant conversation text at submission time';
COMMENT ON COLUMN public.mock_interviews.interview_language IS 'Interview locale code (e.g. en, tr)';
COMMENT ON COLUMN public.mock_interviews.model_version IS 'Groq model id used for final evaluation';
COMMENT ON COLUMN public.mock_interviews.prompt_version IS 'Pipeline / prompt version constant for audit';
