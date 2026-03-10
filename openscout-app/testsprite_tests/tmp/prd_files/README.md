# OpenScout

AI-powered job search and interview platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` (copy from `.env.local.example`):
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

3. Set up Supabase database:
   - Create a new project in Supabase dashboard
   - Run `supabase/migrations/001_initial_schema.sql` in SQL Editor
   - Run `supabase/migrations/002_seed_demo.sql` in SQL Editor
   - Run `supabase/migrations/003_fix_handle_new_user.sql` in SQL Editor
   - Run `supabase/migrations/004_employer_policies.sql` in SQL Editor (enables employer panel writes)
   - Run `supabase/migrations/005_scout_credentials.sql` in SQL Editor (Scout Score / shareable credential)
   - Run `supabase/migrations/006_employer_subscription.sql` in SQL Editor (Stripe subscription fields on companies)
   - Run `supabase/migrations/007_referrals.sql` in SQL Editor (referral_codes + referrals for invite-a-friend)
   - Run `supabase/migrations/008_referrals_update_policy.sql` in SQL Editor (referral upsert policy)

4. (Optional) For employer Stripe subscriptions, set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET`. Webhook URL: `https://your-domain.com/api/stripe-webhook`. In Stripe Dashboard → Developers → Webhooks, add endpoint and subscribe to `customer.subscription.updated`, `customer.subscription.deleted`, and `checkout.session.completed`.

5. (Optional) For public Scout Pass links (`/pass/[slug]`), set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Without it, only authenticated users can create credentials; viewing a pass by link may fail.

6. Start the app:
```bash
npm run dev
```

## Features

- **Landing Page**: Hero, How It Works, FAQ
- **Auth**: Supabase Auth (Sign up / Log in)
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
