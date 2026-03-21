-- Public candidate profile URL slug (e.g. /u/jane-doe) and optional visibility toggle
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_profile_slug TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_profile_hidden BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_public_profile_slug_key
  ON public.profiles (public_profile_slug)
  WHERE public_profile_slug IS NOT NULL;
