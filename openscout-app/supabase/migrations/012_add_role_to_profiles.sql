-- Add role column to profiles for candidate/employer separation
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'candidate';

-- Enforce allowed values (add constraint only if not exists to support re-runs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_role_check CHECK (role IN ('candidate', 'employer'));
  END IF;
END $$;

-- Backfill: users who own a company are employers
UPDATE profiles
SET role = 'employer'
WHERE user_id IN (SELECT user_id FROM companies WHERE user_id IS NOT NULL);
