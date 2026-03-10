-- Restrict viewing job_applications to employers with active subscription (Growth)
DROP POLICY IF EXISTS "Employers can view applications for own listings" ON job_applications;
CREATE POLICY "Employers can view applications for own listings" ON job_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM job_listings jl
      JOIN companies c ON c.id = jl.company_id
      WHERE jl.id = job_applications.job_id
        AND c.user_id = auth.uid()
        AND c.stripe_subscription_status = 'active'
    )
  );
