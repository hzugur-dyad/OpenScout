-- Create cvs bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('cvs', 'cvs', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload CVs to their own folder
CREATE POLICY "Users can upload their own CVs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cvs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update/overwrite their own CVs
CREATE POLICY "Users can update their own CVs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'cvs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read their own CVs
CREATE POLICY "Users can read their own CVs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'cvs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow service_role to read all CVs (for server-side extraction)
-- Note: service_role already bypasses RLS, but this is explicit
CREATE POLICY "Service role can read all CVs"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'cvs');
