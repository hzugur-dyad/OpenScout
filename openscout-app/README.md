# OpenScout

AI-powered job search and interview platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` (copy from `.env.local.example`). Required:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GROQ_API_KEY=your_groq_api_key
```
Optional: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (see steps 4–5).

3. Set up Supabase database:
   - Create a new project in Supabase dashboard
   - Run migrations in order in SQL Editor:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_seed_demo.sql`
   - `supabase/migrations/003_fix_handle_new_user.sql`
   - `supabase/migrations/004_employer_policies.sql` (enables employer panel writes)
   - `supabase/migrations/005_scout_credentials.sql` (Scout Score / shareable credential)
   - `supabase/migrations/006_employer_subscription.sql` (Stripe subscription fields on companies)
   - `supabase/migrations/007_referrals.sql` (referral_codes + referrals for invite-a-friend)
   - `supabase/migrations/008_referrals_update_policy.sql` (referral upsert policy)
   - `supabase/migrations/009_employer_listing_limit.sql` (1 listing per company when not subscribed)
   - `supabase/migrations/010_employer_applications_subscriber_only.sql` (applications view gated by active subscription)
   - `supabase/migrations/011_job_id_cv_and_mock.sql` (job_id on cv_analyses and mock_interviews)

4. (Optional) For employer Stripe subscriptions, set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET`. Webhook URL: `https://your-domain.com/api/stripe-webhook`. In Stripe Dashboard → Developers → Webhooks, add endpoint and subscribe to `customer.subscription.updated`, `customer.subscription.deleted`, and `checkout.session.completed`.

5. (Optional) For public Scout Pass links (`/pass/[slug]`), set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Without it, only authenticated users can create credentials; viewing a pass by link may fail.

6. Start the app:
```bash
npm run dev
```

## Features

- **Landing Page**: Hero, How It Works, FAQ
- **Auth**: Supabase Auth (Sign up / Log in). Unverified users are redirected to `/confirm-email` (resend link available).
- **5-Step Profile**: About, Work Experience, Education, Job Preferences, Links
- **CV Analysis**: PDF/TXT upload, AI evaluation, score and report
- **AI Mock Interview**: Job category selection, microphone test, voice interview (Web Speech API)
- **Job Listings**: List, detail, apply (CV score check + AI interview)
- **Employer Panel**: Create company, post/edit listings, view applications (`/employer`). Pricing at `/employer/pricing` (Stripe).
- **Scout Score (OpenScout Pass)**: After an AI interview, get a shareable credential at `/pass/[slug]`. One credential, many companies.
- **Referrals**: Invite a friend with `?ref=CODE`; attribute on first dashboard load. Blog at `/blog` (positioning and employer/candidate content).

## Employer panel notes

- **Access**: The `/employer` route is protected (requires login).
- **Company ownership**: A company is “owned” by `companies.user_id`. After creating a company in the UI, you can create/edit listings.
- **RLS**: `004_employer_policies.sql` adds policies to allow the owner to insert/update/delete their company and listings, and read applications for their listings.
