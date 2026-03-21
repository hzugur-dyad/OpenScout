-- Reserved for future AI-generated recommendation copy (not populated yet)
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS ai_recommendation_reason text;

COMMENT ON COLUMN public.job_applications.ai_recommendation_reason IS 'Optional future: model-generated hiring recommendation rationale';
