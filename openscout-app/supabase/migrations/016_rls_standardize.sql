-- RLS standardization: ownership, employer applicant visibility (without CV body),
-- and explicit policies on cv_analyses / mock_interviews / job_applications.

-- ---------------------------------------------------------------------------
-- 1) Sensitive CV fields off profiles (owner-only table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_private (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  cv_raw_text TEXT,
  cv_file_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

REVOKE ALL ON public.profile_private FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_private TO authenticated;
GRANT ALL ON public.profile_private TO service_role;

ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own profile_private"
  ON public.profile_private FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own profile_private"
  ON public.profile_private FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own profile_private"
  ON public.profile_private FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own profile_private"
  ON public.profile_private FOR DELETE
  USING (auth.uid() = user_id);

-- Migrate existing CV columns from profiles
INSERT INTO public.profile_private (user_id, cv_raw_text, cv_file_url, updated_at)
SELECT user_id, cv_raw_text, cv_file_url, NOW()
FROM public.profiles
WHERE cv_raw_text IS NOT NULL OR cv_file_url IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  cv_raw_text = COALESCE(EXCLUDED.cv_raw_text, profile_private.cv_raw_text),
  cv_file_url = COALESCE(EXCLUDED.cv_file_url, profile_private.cv_file_url),
  updated_at = NOW();

-- Ensure every profile has a private row (simplifies client upserts)
INSERT INTO public.profile_private (user_id)
SELECT p.user_id FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.profile_private pp WHERE pp.user_id = p.user_id);

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS cv_raw_text,
  DROP COLUMN IF EXISTS cv_file_url;

-- New users get an empty profile_private row alongside profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  INSERT INTO public.profile_private (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Helper: subscribed employer has at least one application from applicant
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_is_subscribed_employer_for_applicant(applicant_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.job_applications ja
    JOIN public.job_listings jl ON jl.id = ja.job_id
    JOIN public.companies c ON c.id = jl.company_id
    WHERE ja.user_id = applicant_user_id
      AND c.user_id = auth.uid()
      AND c.stripe_subscription_status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.auth_is_subscribed_employer_for_applicant(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) profiles: owner full access; employers read applicants they received (subscribed)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Employers read applicant profiles for subscribed listings" ON public.profiles;
CREATE POLICY "Employers read applicant profiles for subscribed listings"
  ON public.profiles FOR SELECT
  USING (public.auth_is_subscribed_employer_for_applicant(user_id));

-- ---------------------------------------------------------------------------
-- 4) cv_analyses: explicit per-command policies (owner-only)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own cv_analyses" ON public.cv_analyses;

CREATE POLICY "Users select own cv_analyses"
  ON public.cv_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own cv_analyses"
  ON public.cv_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own cv_analyses"
  ON public.cv_analyses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own cv_analyses"
  ON public.cv_analyses FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5) mock_interviews: explicit per-command policies (owner-only)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own mock_interviews" ON public.mock_interviews;

CREATE POLICY "Users select own mock_interviews"
  ON public.mock_interviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own mock_interviews"
  ON public.mock_interviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own mock_interviews"
  ON public.mock_interviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own mock_interviews"
  ON public.mock_interviews FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6) job_applications: candidate CRUD on own rows; employers SELECT only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own job_applications" ON public.job_applications;

CREATE POLICY "Candidates select own job_applications"
  ON public.job_applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Candidates insert own job_applications"
  ON public.job_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Candidates update own job_applications"
  ON public.job_applications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Candidates delete own job_applications"
  ON public.job_applications FOR DELETE
  USING (auth.uid() = user_id);

-- Employer policy unchanged in substance (migration 010); kept for clarity
DROP POLICY IF EXISTS "Employers can view applications for own listings" ON public.job_applications;
CREATE POLICY "Employers can view applications for own listings"
  ON public.job_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.job_listings jl
      JOIN public.companies c ON c.id = jl.company_id
      WHERE jl.id = job_applications.job_id
        AND c.user_id = auth.uid()
        AND c.stripe_subscription_status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- 7) job_listings: document intent — public active read + company-owner CRUD
--    (Policies from 001 + 004 remain; no duplicate SELECT for anon conflict.)
-- ---------------------------------------------------------------------------
-- Active listings: "Anyone can view active job_listings" (is_active = true)
-- Owners: "Owners can view own job_listings" (includes inactive for dashboard)
