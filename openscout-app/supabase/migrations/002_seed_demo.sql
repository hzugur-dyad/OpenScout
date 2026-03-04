-- Seed demo company and job for testing
INSERT INTO companies (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Demo Company')
ON CONFLICT (id) DO NOTHING;

INSERT INTO job_listings (id, company_id, title, description, requirements, min_cv_score) VALUES
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Frontend Developer', 'Looking for an experienced frontend developer with React and TypeScript. You will build modern web applications.', 'React, TypeScript, 3+ years experience', 60)
ON CONFLICT (id) DO NOTHING;
