ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE public.mock_interviews
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS turn_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transcript_hash TEXT,
  ADD COLUMN IF NOT EXISTS session_state TEXT NOT NULL DEFAULT 'started';

UPDATE public.mock_interviews
SET
  started_at = COALESCE(started_at, created_at),
  last_activity_at = COALESCE(last_activity_at, created_at),
  completed_at = CASE
    WHEN completed_at IS NOT NULL THEN completed_at
    WHEN report IS NOT NULL THEN created_at
    ELSE NULL
  END,
  session_state = CASE
    WHEN report IS NOT NULL THEN 'completed'
    ELSE COALESCE(session_state, 'started')
  END;

ALTER TABLE public.mock_interviews
  ALTER COLUMN started_at SET DEFAULT NOW(),
  ALTER COLUMN started_at SET NOT NULL,
  ALTER COLUMN last_activity_at SET DEFAULT NOW(),
  ALTER COLUMN last_activity_at SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.mock_interviews
    ADD CONSTRAINT mock_interviews_turn_count_non_negative
    CHECK (turn_count >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.mock_interviews
    ADD CONSTRAINT mock_interviews_session_state_check
    CHECK (session_state IN ('started', 'completed'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_mock_interviews_user_state
  ON public.mock_interviews (user_id, session_state, last_activity_at DESC);
