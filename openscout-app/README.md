# OpenScout

AI-powered job search and interview platform.

## Deployment

Vercel should use `openscout-app` as the Root Directory and `npm run build:vercel` as the build command.

See [docs/DEPLOYMENT.md](/C:/Users/ugurs/Desktop/OpenScout/openscout-app/docs/DEPLOYMENT.md) for deployment setup and environment requirements.
See [docs/RELEASE_CHECKLIST.md](/C:/Users/ugurs/Desktop/OpenScout/openscout-app/docs/RELEASE_CHECKLIST.md) for the pre-release checklist.

### Branching (short)

- **`main`**: production; merge only when ready to release.
- **`guncelleme`**: ongoing updates and integration; merge to `main` via PR when stable.
- Optional feature branches can branch from `guncelleme`, merge back into `guncelleme`, and then ship through `guncelleme -> main`.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` by copying `.env.example`. Minimum local variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GROQ_API_KEY=your_groq_api_key
```

For the full env list, see [.env.example](/C:/Users/ugurs/Desktop/OpenScout/openscout-app/.env.example).

3. Set up Supabase database:
   - Create a new project in the Supabase dashboard.
   - Run migrations in order in SQL Editor.
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_seed_demo.sql`
   - `supabase/migrations/003_fix_handle_new_user.sql`
   - `supabase/migrations/004_employer_policies.sql`
   - `supabase/migrations/005_scout_credentials.sql`
   - `supabase/migrations/006_employer_subscription.sql`
   - `supabase/migrations/007_referrals.sql`
   - `supabase/migrations/008_referrals_update_policy.sql`
   - `supabase/migrations/009_employer_listing_limit.sql`
   - `supabase/migrations/010_employer_applications_subscriber_only.sql`
   - `supabase/migrations/011_job_id_cv_and_mock.sql`

4. Optional billing setup:
   - Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CANDIDATE_PLUS_PRICE_ID`, `STRIPE_CANDIDATE_PRO_PRICE_ID`, `STRIPE_EMPLOYER_GROWTH_PRICE_ID`, and `STRIPE_EMPLOYER_SCALE_PRICE_ID`.
   - Use `https://your-domain.com/api/stripe-webhook` as the webhook URL.
   - In Stripe Dashboard -> Developers -> Webhooks, subscribe to `customer.subscription.updated`, `customer.subscription.deleted`, and `checkout.session.completed`.

5. Optional public Scout Pass setup:
   - Set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
   - Without it, authenticated creation may work but public pass access can fail.

6. Start the app:

```bash
npm run dev
```

## Features

- **Landing Page**: Hero, How It Works, FAQ.
- **Auth**: Supabase Auth with email verification flow.
- **5-Step Profile**: About, Work Experience, Education, Job Preferences, Links.
- **CV Analysis**: PDF/TXT upload, AI evaluation, score, and report.
- **AI Mock Interview**: Job category selection, microphone test, and voice interview flow.
- **Job Listings**: List, detail, and apply flows.
- **Employer Panel**: Company, listings, and application review flows.
- **Scout Score (OpenScout Pass)**: Shareable credential after AI interview completion.
- **Referrals**: Invite flow with code attribution on dashboard entry.

## Employer panel notes

- **Access**: `/employer` requires login.
- **Company ownership**: company ownership is tied to `companies.user_id`.
- **RLS**: `004_employer_policies.sql` allows the owner to manage their company and listings, and read applications for their listings.

## Maintenance note

Repository sync checkpoint commit.
