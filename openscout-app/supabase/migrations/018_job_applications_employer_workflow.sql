-- Employer hiring workflow (separate from legacy candidate submission `status` e.g. "completed")
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS application_status text NOT NULL DEFAULT 'applied';

ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_application_status_check;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_application_status_check
  CHECK (application_status IN ('applied', 'shortlisted', 'rejected'));

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.job_applications.application_status IS 'Employer pipeline: applied | shortlisted | rejected';
COMMENT ON COLUMN public.job_applications.notes IS 'Employer-private notes';

-- Employers may update applications for their subscribed company jobs (e.g. status, notes)
DROP POLICY IF EXISTS "Employers update applications for own listings" ON public.job_applications;
CREATE POLICY "Employers update applications for own listings"
  ON public.job_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.job_listings jl
      JOIN public.companies c ON c.id = jl.company_id
      WHERE jl.id = job_applications.job_id
        AND c.user_id = auth.uid()
        AND c.stripe_subscription_status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.job_listings jl
      JOIN public.companies c ON c.id = jl.company_id
      WHERE jl.id = job_applications.job_id
        AND c.user_id = auth.uid()
        AND c.stripe_subscription_status = 'active'
    )
  );
