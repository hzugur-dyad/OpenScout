-- Employer policies for companies, job_listings, and applications access

-- Companies: allow owners to create and manage their company
CREATE POLICY "Owners can create company" ON companies
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update own company" ON companies
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete own company" ON companies
  FOR DELETE
  USING (auth.uid() = user_id);

-- Job listings: allow owners (via companies.user_id) to manage their listings
CREATE POLICY "Owners can view own job_listings" ON job_listings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM companies c
      WHERE c.id = job_listings.company_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can create job_listings" ON job_listings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM companies c
      WHERE c.id = job_listings.company_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update own job_listings" ON job_listings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM companies c
      WHERE c.id = job_listings.company_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can delete own job_listings" ON job_listings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM companies c
      WHERE c.id = job_listings.company_id
        AND c.user_id = auth.uid()
    )
  );

-- Applications: allow employers to view applications for their listings
CREATE POLICY "Employers can view applications for own listings" ON job_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM job_listings jl
      JOIN companies c ON c.id = jl.company_id
      WHERE jl.id = job_applications.job_id
        AND c.user_id = auth.uid()
    )
  );

