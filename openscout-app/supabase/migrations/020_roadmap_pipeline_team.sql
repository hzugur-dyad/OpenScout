-- Mock interview: duration for analytics / risk signals
ALTER TABLE public.mock_interviews
  ADD COLUMN IF NOT EXISTS duration_ms integer;

COMMENT ON COLUMN public.mock_interviews.duration_ms IS 'Client-reported active interview duration in milliseconds';

-- Expand employer pipeline stages
ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_application_status_check;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_application_status_check
  CHECK (
    application_status IN (
      'applied',
      'screening',
      'shortlisted',
      'interviewing',
      'offer',
      'hired',
      'rejected'
    )
  );

-- Activity log for hiring workflow
CREATE TABLE IF NOT EXISTS public.application_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('status_change', 'note_update', 'bulk_status_change')),
  old_status text,
  new_status text,
  note_excerpt text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_events_application ON public.application_events(job_application_id);

ALTER TABLE public.application_events ENABLE ROW LEVEL SECURITY;

-- Multi-seat employer access
CREATE TABLE IF NOT EXISTS public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'recruiter', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_members_user ON public.company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON public.company_members(company_id);

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

INSERT INTO public.company_members (company_id, user_id, role)
SELECT c.id, c.user_id, 'owner'
FROM public.companies c
WHERE c.user_id IS NOT NULL
ON CONFLICT (company_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_company_owner_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.company_members (company_id, user_id, role)
    VALUES (NEW.id, NEW.user_id, 'owner')
    ON CONFLICT (company_id, user_id) DO UPDATE SET role = excluded.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS companies_owner_member ON public.companies;
CREATE TRIGGER companies_owner_member
  AFTER INSERT OR UPDATE OF user_id ON public.companies
  FOR EACH ROW
  WHEN (NEW.user_id IS NOT NULL)
  EXECUTE PROCEDURE public.ensure_company_owner_member();

-- RLS: company_members
CREATE POLICY "Users see company_members for their companies"
  ON public.company_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.company_members me
      WHERE me.company_id = company_members.company_id AND me.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_members.company_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners add company members"
  ON public.company_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.company_id = company_id AND m.user_id = auth.uid() AND m.role = 'owner'
    )
  );

CREATE POLICY "Owners remove company members"
  ON public.company_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_members.company_id AND c.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.company_id = company_members.company_id AND m.user_id = auth.uid() AND m.role = 'owner'
    )
  );

-- application_events: subscribed employer staff may read/write for their jobs
CREATE POLICY "Employer staff read application_events"
  ON public.application_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.job_applications ja
      JOIN public.job_listings jl ON jl.id = ja.job_id
      JOIN public.companies c ON c.id = jl.company_id
      WHERE ja.id = application_events.job_application_id
        AND c.stripe_subscription_status = 'active'
        AND (
          c.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = c.id AND cm.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Employer staff insert application_events"
  ON public.application_events FOR INSERT
  WITH CHECK (
    actor_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.job_applications ja
      JOIN public.job_listings jl ON jl.id = ja.job_id
      JOIN public.companies c ON c.id = jl.company_id
      WHERE ja.id = job_application_id
        AND c.stripe_subscription_status = 'active'
        AND (
          c.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = c.id AND cm.user_id = auth.uid()
              AND cm.role IN ('owner', 'recruiter')
          )
        )
    )
  );

-- Replace employer-only policies to include company staff
DROP POLICY IF EXISTS "Employers can view applications for own listings" ON public.job_applications;
CREATE POLICY "Employers can view applications for own listings"
  ON public.job_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.job_listings jl
      JOIN public.companies c ON c.id = jl.company_id
      WHERE jl.id = job_applications.job_id
        AND c.stripe_subscription_status = 'active'
        AND (
          c.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = c.id AND cm.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Employers update applications for own listings" ON public.job_applications;
CREATE POLICY "Employers update applications for own listings"
  ON public.job_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.job_listings jl
      JOIN public.companies c ON c.id = jl.company_id
      WHERE jl.id = job_applications.job_id
        AND c.stripe_subscription_status = 'active'
        AND (
          c.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = c.id AND cm.user_id = auth.uid()
              AND cm.role IN ('owner', 'recruiter')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.job_listings jl
      JOIN public.companies c ON c.id = jl.company_id
      WHERE jl.id = job_applications.job_id
        AND c.stripe_subscription_status = 'active'
        AND (
          c.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = c.id AND cm.user_id = auth.uid()
              AND cm.role IN ('owner', 'recruiter')
          )
        )
    )
  );

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
      AND c.stripe_subscription_status = 'active'
      AND (
        c.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.company_members cm
          WHERE cm.company_id = c.id AND cm.user_id = auth.uid()
        )
      )
  );
$$;

-- Job listings: owner OR recruiter may mutate; any staff may view own listings
DROP POLICY IF EXISTS "Owners can view own job_listings" ON public.job_listings;
CREATE POLICY "Employer staff can view own job_listings"
  ON public.job_listings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = job_listings.company_id
        AND (
          c.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = c.id AND cm.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Owners can create job_listings" ON public.job_listings;
CREATE POLICY "Employer recruiters create job_listings"
  ON public.job_listings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = job_listings.company_id
        AND (
          c.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = c.id AND cm.user_id = auth.uid()
              AND cm.role IN ('owner', 'recruiter')
          )
        )
    )
  );

DROP POLICY IF EXISTS "Owners can update own job_listings" ON public.job_listings;
CREATE POLICY "Employer recruiters update job_listings"
  ON public.job_listings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = job_listings.company_id
        AND (
          c.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = c.id AND cm.user_id = auth.uid()
              AND cm.role IN ('owner', 'recruiter')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = job_listings.company_id
        AND (
          c.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = c.id AND cm.user_id = auth.uid()
              AND cm.role IN ('owner', 'recruiter')
          )
        )
    )
  );

DROP POLICY IF EXISTS "Owners can delete own job_listings" ON public.job_listings;
CREATE POLICY "Employer recruiters delete job_listings"
  ON public.job_listings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = job_listings.company_id
        AND (
          c.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = c.id AND cm.user_id = auth.uid()
              AND cm.role IN ('owner', 'recruiter')
          )
        )
    )
  );

DROP POLICY IF EXISTS "Owners can update own company" ON public.companies;
CREATE POLICY "Company owners update company"
  ON public.companies FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = companies.id AND cm.user_id = auth.uid() AND cm.role = 'owner'
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = companies.id AND cm.user_id = auth.uid() AND cm.role = 'owner'
    )
  );
